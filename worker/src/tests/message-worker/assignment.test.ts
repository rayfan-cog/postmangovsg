import { Sequelize } from 'sequelize-typescript'
import assignment from '@core/loaders/message-worker/util/assignment'
import ECSUtil from '@core/loaders/message-worker/util/ecs'

jest.mock('@core/loaders/message-worker/util/ecs', () => ({
  __esModule: true,
  default: { getWorkersInService: jest.fn() },
}))

const getWorkersInService = ECSUtil.getWorkersInService as jest.Mock

const mockConnection = (
  dbWorkers: string[],
  updateRowCount: number
): { connection: Sequelize; query: jest.Mock } => {
  const query = jest.fn((sql: string) => {
    if (sql.startsWith('SELECT id FROM workers')) {
      return Promise.resolve([dbWorkers.map((id) => ({ id }))])
    }
    if (sql.startsWith('UPDATE workers')) {
      return Promise.resolve([undefined, updateRowCount])
    }
    return Promise.resolve([undefined, 1])
  })
  return { connection: { query } as unknown as Sequelize, query }
}

const countQueries = (query: jest.Mock, prefix: string): number =>
  query.mock.calls.filter(([sql]) => (sql as string).startsWith(prefix)).length

describe('assignment', () => {
  beforeEach(() => {
    jest.spyOn(Math, 'random').mockReturnValue(0)
    getWorkersInService.mockReset()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('inserts a new worker when there are no dead workers', async () => {
    getWorkersInService.mockResolvedValue(['alive'])
    const { connection, query } = mockConnection(['alive'], 0)

    await expect(assignment(connection, 'new')).resolves.toBe(true)
    expect(countQueries(query, 'INSERT INTO workers')).toBe(1)
  })

  test('replaces a dead worker', async () => {
    getWorkersInService.mockResolvedValue(['alive'])
    const { connection, query } = mockConnection(['alive', 'dead'], 1)

    await expect(assignment(connection, 'new')).resolves.toBe(true)
    expect(countQueries(query, 'UPDATE workers')).toBe(1)
    expect(countQueries(query, 'INSERT INTO workers')).toBe(0)
  })

  test('stops retrying after max attempts when replacement keeps failing', async () => {
    getWorkersInService.mockResolvedValue(['alive'])
    const { connection, query } = mockConnection(['alive', 'dead'], 0)

    await expect(assignment(connection, 'new')).resolves.toBe(false)
    expect(countQueries(query, 'UPDATE workers')).toBe(10)
  })

  test('returns false when looking up dead workers fails', async () => {
    getWorkersInService.mockRejectedValue(new Error('ECS unavailable'))
    const { connection, query } = mockConnection([], 0)

    await expect(assignment(connection, 'new')).resolves.toBe(false)
    expect(query).not.toHaveBeenCalled()
  })
})
