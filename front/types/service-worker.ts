export type PushDisplayOptions = {
  body: string
  icon: string
  badge: string
  tag: string
  data: { url: string }
}

export type PushDisplay = {
  title: string
  options: PushDisplayOptions
}
