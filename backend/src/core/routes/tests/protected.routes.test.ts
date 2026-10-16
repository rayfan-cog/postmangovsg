import request from 'supertest'
import { Sequelize } from 'sequelize-typescript'
import initialiseServer from '@test-utils/server'
import { Campaign, ProtectedMessage, User } from '@core/models'
import sequelizeLoader from '@test-utils/sequelize-loader'
import { ChannelType } from '@core/constants'
import {
  PROTECT_VERIFY_IP_MAX_FAILURES,
  PROTECT_VERIFY_MESSAGE_MAX_FAILURES,
} from '@core/routes/protected.routes'

const app = initialiseServer(true)
let sequelize: Sequelize
let campaignId: number

beforeAll(async () => {
  sequelize = await sequelizeLoader(process.env.JEST_WORKER_ID || '1')
  await User.create({ id: 1, email: 'user@agency.gov.sg' } as User)
  const campaign = await Campaign.create({
    name: 'campaign-1',
    userId: 1,
    type: ChannelType.Email,
    valid: false,
    protect: true,
  } as Campaign)
  campaignId = campaign.id
})

afterEach(async () => {
  await ProtectedMessage.destroy({ where: {}, force: true })
  await new Promise((resolve) =>
    (app as any).redisService.rateLimitClient.flushdb(resolve)
  )
})

afterAll(async () => {
  await Campaign.destroy({ where: {}, force: true })
  await User.destroy({ where: {} })
  await sequelize.close()
  await (app as any).cleanup()
})

describe('POST /protected/{id}', () => {
  test('Fail to retrieve protected message for non-existent id', async () => {
    const id = '123'
    const res = await request(app).post(`/protect/${id}`).send({
      password_hash: 'abc',
    })
    expect(res.status).toBe(403)
    expect(res.body).toEqual({
      message: 'Wrong password or message id. Please try again.',
    })
  })

  test('Fail to retrieve protected message for wrong password hash', async () => {
    const id = '123'
    await ProtectedMessage.create({
      id: '123',
      campaignId,
      passwordHash: 'def',
      payload: 'encrypted message',
      version: 1,
    } as ProtectedMessage)

    const res = await request(app).post(`/protect/${id}`).send({
      password_hash: 'abc',
    })
    expect(res.status).toBe(403)
    expect(res.body).toEqual({
      message: 'Wrong password or message id. Please try again.',
    })
  })

  test('Successfully retrieve protected message', async () => {
    const id = '123'
    await ProtectedMessage.create({
      id: '123',
      campaignId,
      passwordHash: 'def',
      payload: 'encrypted message',
      version: 1,
    } as ProtectedMessage)

    const res = await request(app).post(`/protect/${id}`).send({
      password_hash: 'def',
    })
    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      payload: 'encrypted message',
    })
  })

  describe('rate limiting', () => {
    const id = '123'
    const createMessage = () =>
      ProtectedMessage.create({
        id,
        campaignId,
        passwordHash: 'def',
        payload: 'encrypted message',
        version: 1,
      } as ProtectedMessage)
    const attempt = (passwordHash: string, ip = '1.1.1.1') =>
      request(app)
        .post(`/protect/${id}`)
        .set('cf-connecting-ip', ip)
        .send({ password_hash: passwordHash })

    test('Blocks a client after too many failed attempts, even with the correct password', async () => {
      await createMessage()
      for (let i = 0; i < PROTECT_VERIFY_IP_MAX_FAILURES; i++) {
        const res = await attempt('wrong')
        expect(res.status).toBe(403)
      }

      const blocked = await attempt('wrong')
      expect(blocked.status).toBe(429)
      expect(blocked.body).toEqual({
        code: 'rate_limit',
        message: 'Too many failed attempts. Please try again later.',
      })

      const correctButBlocked = await attempt('def')
      expect(correctButBlocked.status).toBe(429)
      expect(correctButBlocked.body).not.toHaveProperty('payload')

      // A different client is not affected by the per-client limit
      const otherClient = await attempt('def', '2.2.2.2')
      expect(otherClient.status).toBe(200)
    })

    test('Successful attempts do not count towards the limit', async () => {
      await createMessage()
      for (let i = 0; i < PROTECT_VERIFY_IP_MAX_FAILURES + 5; i++) {
        const res = await attempt('def')
        expect(res.status).toBe(200)
      }
      const res = await attempt('wrong')
      expect(res.status).toBe(403)
    })

    test('Locks the message after too many failed attempts across clients', async () => {
      await createMessage()
      for (let i = 0; i < PROTECT_VERIFY_MESSAGE_MAX_FAILURES; i++) {
        const res = await attempt('wrong', `10.0.0.${i}`)
        expect(res.status).toBe(403)
      }

      const res = await attempt('def', '10.0.1.1')
      expect(res.status).toBe(429)
      expect(res.body).not.toHaveProperty('payload')
    })
  })
})
