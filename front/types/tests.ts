export type FakeRequest = {
  method: string
  path: string
  body: unknown
  headers: Record<string, string>
}

export type FakeHandler = (request: FakeRequest) => unknown

export type FakeFailure = {
  statusCode: number
  data: unknown
}
