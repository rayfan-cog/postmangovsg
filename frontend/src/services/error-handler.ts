import axios, { AxiosError } from 'axios'

// Rethrows an API error with the server-provided message, falling back to
// defaultMsg and then the HTTP status text.
export function errorHandler(e: unknown, defaultMsg?: string): never {
  console.error(e)
  if (
    axios.isAxiosError(e) &&
    e.response &&
    e.response.data &&
    e.response.data.message
  ) {
    throw new Error(e.response.data.message)
  }
  throw new Error(defaultMsg || (e as AxiosError).response?.statusText)
}

// Rethrows an API error with a per-status message if one is provided,
// otherwise the server-provided message or the HTTP status text.
export function statusErrorHandler(
  e: unknown,
  customHandlers: Record<number, string> = {}
): never {
  if (axios.isAxiosError(e) && e.response && e.response.status) {
    const code = e.response.status
    if (customHandlers[code]) {
      throw new Error(customHandlers[code])
    } else if (e.response.data?.message) {
      throw new Error(e.response.data.message)
    } else {
      throw new Error(e.response.statusText)
    }
  }
  throw new Error(`${e}`)
}
