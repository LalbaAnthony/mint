import type { VNodeChild } from 'vue'
import type { RouteLocationRaw } from 'vue-router'

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

export type AppMountOptions = {
  props?: Record<string, unknown>
  slots?: Record<string, () => VNodeChild>
  route?: RouteLocationRaw
  attachTo?: HTMLElement | string
  global?: { stubs?: Record<string, boolean> }
}
