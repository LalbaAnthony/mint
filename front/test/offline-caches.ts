import { vi } from 'vitest'

export function installMemoryCaches(): Map<string, Map<string, string>> {
  const stores = new Map<string, Map<string, string>>()
  const storeOf = (name: string) => {
    const existing = stores.get(name)
    if (existing !== undefined) {
      return existing
    }
    const created = new Map<string, string>()
    stores.set(name, created)
    return created
  }
  vi.stubGlobal('caches', {
    open: (name: string) =>
      Promise.resolve({
        match: (request: Request) => {
          const body = storeOf(name).get(request.url)
          return Promise.resolve(
            body === undefined ? undefined : new Response(body),
          )
        },
        put: async (request: Request, response: Response) => {
          storeOf(name).set(request.url, await response.text())
        },
      }),
    delete: (name: string) => Promise.resolve(stores.delete(name)),
  })
  return stores
}
