import type { Locale } from '@mint/shared/types/user'

export type MailMessage = {
  to: string
  subject: string
  text: string
}

export type Mailer = {
  send: (message: MailMessage) => Promise<void>
}

export type MessageTemplate = {
  subject: string
  intro: string
  action: string
  validity: string
  ignore: string
}

export type LocalizedTemplates = Record<Locale, MessageTemplate>
