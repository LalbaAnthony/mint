import { describe, expect, it } from 'vitest'
import {
  buildLink,
  emailChangeMessage,
  invitationMessage,
  passwordResetMessage,
} from './messages.js'

const link = buildLink('https://mint.dev-it.app', '/invitation', 'abc_DEF-123')

describe('buildLink', () => {
  it('carries the token in the fragment, never sent to a server', () => {
    expect(link).toBe('https://mint.dev-it.app/invitation#token=abc_DEF-123')
  })
})

describe('invitationMessage', () => {
  it('is bilingual, French first, with the link in both parts', () => {
    const message = invitationMessage('invitee@example.org', link)

    expect(message.to).toBe('invitee@example.org')
    expect(message.subject).toBe(
      'Invitation à rejoindre Mint / Invitation to join Mint',
    )
    const [french, english] = message.text.split('--------')
    expect(french).toContain('valable 7 jours')
    expect(french).toContain(link)
    expect(english).toContain('valid for 7 days')
    expect(english).toContain(link)
  })
})

describe('localized messages', () => {
  it('writes the reset email in the user language', () => {
    expect(passwordResetMessage('a@example.org', 'fr', link).text).toContain(
      'valable 1 heure',
    )
    expect(passwordResetMessage('a@example.org', 'en', link).subject).toBe(
      'Reset your Mint password',
    )
  })

  it('writes the email change confirmation in the user language', () => {
    const message = emailChangeMessage('new@example.org', 'en', link)

    expect(message.to).toBe('new@example.org')
    expect(message.text).toContain('confirm the change')
  })
})
