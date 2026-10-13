import { NextFunction, Request, Response } from 'express'
import { UploadMiddleware } from '@core/middlewares/upload.middleware'
import { UploadService } from '@core/services'
import { RecipientColumnMissing } from '@core/errors'
import { ApiInvalidTemplateError } from '@core/errors/rest-api.errors'
import { SmsTemplate } from '@sms/models'

const template = { body: 'hi {{name}}', params: ['name'] } as SmsTemplate

const makeReq = (): Request =>
  ({
    params: { campaignId: '1' },
    body: { transaction_id: 'txn', filename: 'file.csv', etag: 'body-etag' },
  } as unknown as Request)

const makeRes = (): Response =>
  ({
    locals: { etag: 'locals-etag' },
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response)

beforeEach(() => {
  jest
    .spyOn(UploadService, 'extractParamsFromJwt')
    .mockReturnValue({ s3Key: 'key' })
  jest.spyOn(UploadService, 'storeS3TempFilename').mockResolvedValue()
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('makeUploadCompleteHandler', () => {
  test('stores temp filename, enqueues upload and responds 202', async () => {
    const enqueueUpload = jest.fn().mockResolvedValue('1')
    const handler = UploadMiddleware.makeUploadCompleteHandler({
      getFilledTemplate: jest.fn().mockResolvedValue(template),
      enqueueUpload,
      missingTemplateError: () => new Error('missing'),
    })
    const res = makeRes()
    const next = jest.fn() as NextFunction

    await handler(makeReq(), res, next)

    expect(UploadService.storeS3TempFilename).toHaveBeenCalledWith(
      1,
      'file.csv'
    )
    expect(enqueueUpload).toHaveBeenCalledWith({
      campaignId: 1,
      template,
      s3Key: 'key',
      etag: 'body-etag',
      filename: 'file.csv',
    })
    expect(res.status).toHaveBeenCalledWith(202)
    expect(res.json).toHaveBeenCalledWith({ id: '1' })
    expect(next).not.toHaveBeenCalled()
  })

  test('uses custom etag and response body', async () => {
    const enqueueUpload = jest.fn().mockResolvedValue('1')
    const handler = UploadMiddleware.makeUploadCompleteHandler({
      getFilledTemplate: jest.fn().mockResolvedValue(template),
      enqueueUpload,
      missingTemplateError: () => new Error('missing'),
      getEtag: (_req, res) => res.locals.etag,
      getResponseBody: (req) => ({ transaction_id: req.body.transaction_id }),
    })
    const res = makeRes()

    await handler(makeReq(), res, jest.fn())

    expect(enqueueUpload).toHaveBeenCalledWith(
      expect.objectContaining({ etag: 'locals-etag' })
    )
    expect(res.json).toHaveBeenCalledWith({ transaction_id: 'txn' })
  })

  test('forwards the missing template error without enqueueing', async () => {
    const missingTemplateError = new Error('missing')
    const enqueueUpload = jest.fn()
    const handler = UploadMiddleware.makeUploadCompleteHandler({
      getFilledTemplate: jest.fn().mockResolvedValue(null),
      enqueueUpload,
      missingTemplateError: () => missingTemplateError,
    })
    const next = jest.fn() as NextFunction

    await handler(makeReq(), makeRes(), next)

    expect(next).toHaveBeenCalledWith(missingTemplateError)
    expect(UploadService.storeS3TempFilename).not.toHaveBeenCalled()
    expect(enqueueUpload).not.toHaveBeenCalled()
  })

  test('remaps user errors to ApiInvalidTemplateError', async () => {
    const handler = UploadMiddleware.makeUploadCompleteHandler({
      getFilledTemplate: jest.fn().mockResolvedValue(template),
      enqueueUpload: jest.fn().mockRejectedValue(new RecipientColumnMissing()),
      missingTemplateError: () => new Error('missing'),
    })

    await expect(
      handler(makeReq(), makeRes(), jest.fn())
    ).rejects.toBeInstanceOf(ApiInvalidTemplateError)
  })
})
