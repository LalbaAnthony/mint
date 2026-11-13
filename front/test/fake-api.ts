import type { Mock } from 'vitest'
import type { FakeFailure, FakeHandler, FakeRequest } from '~~/types/tests'

export function apiFailure(statusCode: number, data: unknown): FakeFailure {
  return { statusCode, data }
}

function isFailure(value: unknown): value is FakeFailure {
  return typeof value === 'object' && value !== null && 'statusCode' in value
}

function readOption(
  options: unknown,
  key: 'method' | 'body' | 'headers',
): unknown {
  return typeof options === 'object' && options !== null
    ? Reflect.get(options, key)
    : undefined
}

function readHeaders(options: unknown): Record<string, string> {
  const headers = readOption(options, 'headers')
  if (typeof headers !== 'object' || headers === null) {
    return {}
  }
  return Object.fromEntries(
    Object.entries(headers).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  )
}

export function installFakeApi(
  fetchMock: Mock,
  handlers: Record<string, FakeHandler>,
) {
  const requests: FakeRequest[] = []
  fetchMock.mockReset()
  fetchMock.mockImplementation(async (url: string, options?: unknown) => {
    const method = String(readOption(options, 'method') ?? 'GET')
    const path = url.replace(/^\/api\/v1/, '')
    const request = {
      method,
      path,
      body: readOption(options, 'body'),
      headers: readHeaders(options),
    }
    requests.push(request)
    const handler = handlers[`${method} ${path}`]
    if (handler === undefined) {
      if (path === '/csrf') {
        return { token: 'csrf-token' }
      }
      throw apiFailure(404, { error: 'not_found' })
    }
    const result = handler(request)
    if (isFailure(result)) {
      throw result
    }
    return result
  })
  return { requests }
}
