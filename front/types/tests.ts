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

export type SelectHandle = {
  value: () => unknown
  items: () => unknown
  choose: (value: string) => void
}
