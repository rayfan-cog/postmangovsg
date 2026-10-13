import { AxiosError, AxiosResponse } from 'axios'

import { errorHandler, statusErrorHandler } from '../error-handler'

function makeAxiosError(
  status: number,
  statusText: string,
  data: unknown = {}
): AxiosError {
  return new AxiosError('Request failed', undefined, undefined, undefined, {
    status,
    statusText,
    data,
    headers: {},
  } as AxiosResponse)
}

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('errorHandler', () => {
  test('rethrows the server-provided message', () => {
    const e = makeAxiosError(400, 'Bad Request', { message: 'Server says no' })
    expect(() => errorHandler(e, 'Default')).toThrow(
      new Error('Server says no')
    )
  })

  test('falls back to the default message', () => {
    const e = makeAxiosError(500, 'Internal Server Error')
    expect(() => errorHandler(e, 'Default')).toThrow(new Error('Default'))
    expect(() => errorHandler(new Error('boom'), 'Default')).toThrow(
      new Error('Default')
    )
  })

  test('falls back to the status text without a default message', () => {
    const e = makeAxiosError(502, 'Bad Gateway')
    expect(() => errorHandler(e)).toThrow(new Error('Bad Gateway'))
  })

  test('logs the original error', () => {
    const e = makeAxiosError(500, 'Internal Server Error')
    expect(() => errorHandler(e, 'Default')).toThrow()
    expect(console.error).toHaveBeenCalledWith(e)
  })
})

describe('statusErrorHandler', () => {
  test('prefers the custom message for the response status', () => {
    const e = makeAxiosError(401, 'Unauthorized', { message: 'Server says no' })
    expect(() => statusErrorHandler(e, { 401: 'Invalid OTP' })).toThrow(
      new Error('Invalid OTP')
    )
  })

  test('falls back to the server-provided message', () => {
    const e = makeAxiosError(401, 'Unauthorized', { message: 'Server says no' })
    expect(() => statusErrorHandler(e, { 400: 'Bad format' })).toThrow(
      new Error('Server says no')
    )
  })

  test('falls back to the status text', () => {
    const e = makeAxiosError(503, 'Service Unavailable')
    expect(() => statusErrorHandler(e)).toThrow(
      new Error('Service Unavailable')
    )
  })

  test('stringifies non-axios errors', () => {
    expect(() => statusErrorHandler(new Error('boom'))).toThrow(
      new Error('Error: boom')
    )
  })
})
