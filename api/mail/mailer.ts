import { createTransport } from 'nodemailer'
import type { MailEnvironment } from '../types/environment.js'
import type { Mailer } from '../types/mail.js'

export function createSmtpMailer(environment: MailEnvironment): Mailer {
  const transporter = createTransport({
    host: environment.SMTP_HOST,
    port: environment.SMTP_PORT,
    secure: environment.SMTP_TLS_MODE === 'tls',
    requireTLS: environment.SMTP_TLS_MODE === 'starttls',
    ignoreTLS: environment.SMTP_TLS_MODE === 'none',
    auth:
      environment.SMTP_USER !== undefined &&
      environment.SMTP_PASSWORD !== undefined
        ? { user: environment.SMTP_USER, pass: environment.SMTP_PASSWORD }
        : undefined,
  })

  return {
    send: async (message) => {
      await transporter.sendMail({ from: environment.MAIL_FROM, ...message })
    },
  }
}
