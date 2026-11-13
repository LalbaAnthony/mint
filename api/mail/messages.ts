import type { Locale } from '@mint/shared/types/user'
import type {
  LocalizedTemplates,
  MailMessage,
  MessageTemplate,
} from '../types/mail.js'

const invitationTemplates: LocalizedTemplates = {
  fr: {
    subject: 'Invitation à rejoindre Mint',
    intro: 'Vous êtes invité à créer votre compte Mint.',
    action: 'Ouvrez ce lien pour choisir votre mot de passe et votre langue :',
    validity: "Ce lien est valable 7 jours et ne peut servir qu'une fois.",
    ignore: "Si vous n'attendiez pas cette invitation, ignorez ce message.",
  },
  en: {
    subject: 'Invitation to join Mint',
    intro: 'You have been invited to create your Mint account.',
    action: 'Open this link to choose your password and language:',
    validity: 'This link is valid for 7 days and can be used only once.',
    ignore: 'If you were not expecting this invitation, ignore this message.',
  },
}

const passwordResetTemplates: LocalizedTemplates = {
  fr: {
    subject: 'Réinitialisation de votre mot de passe Mint',
    intro:
      'Une réinitialisation du mot de passe de votre compte Mint a été demandée.',
    action: 'Ouvrez ce lien pour choisir un nouveau mot de passe :',
    validity: "Ce lien est valable 1 heure et ne peut servir qu'une fois.",
    ignore:
      "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message : votre mot de passe reste inchangé.",
  },
  en: {
    subject: 'Reset your Mint password',
    intro: 'A password reset was requested for your Mint account.',
    action: 'Open this link to choose a new password:',
    validity: 'This link is valid for 1 hour and can be used only once.',
    ignore:
      'If you did not request it, ignore this message: your password stays unchanged.',
  },
}

const emailChangeTemplates: LocalizedTemplates = {
  fr: {
    subject: 'Confirmez votre nouvelle adresse email Mint',
    intro: 'Vous avez demandé à utiliser cette adresse pour votre compte Mint.',
    action: 'Ouvrez ce lien pour confirmer le changement :',
    validity: "Ce lien est valable 1 heure et ne peut servir qu'une fois.",
    ignore:
      "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.",
  },
  en: {
    subject: 'Confirm your new Mint email address',
    intro: 'You asked to use this address for your Mint account.',
    action: 'Open this link to confirm the change:',
    validity: 'This link is valid for 1 hour and can be used only once.',
    ignore: 'If you did not request it, ignore this message.',
  },
}

const bilingualSeparator = '\n\n--------\n\n'

export function buildLink(
  appOrigin: string,
  path: string,
  token: string,
): string {
  return `${appOrigin}${path}#token=${token}`
}

function renderBody(template: MessageTemplate, link: string): string {
  return [
    template.intro,
    '',
    template.action,
    link,
    '',
    template.validity,
    template.ignore,
  ].join('\n')
}

export function invitationMessage(to: string, link: string): MailMessage {
  const { fr, en } = invitationTemplates
  return {
    to,
    subject: `${fr.subject} / ${en.subject}`,
    text: [renderBody(fr, link), renderBody(en, link)].join(bilingualSeparator),
  }
}

export function passwordResetMessage(
  to: string,
  locale: Locale,
  link: string,
): MailMessage {
  const template = passwordResetTemplates[locale]
  return { to, subject: template.subject, text: renderBody(template, link) }
}

export function emailChangeMessage(
  to: string,
  locale: Locale,
  link: string,
): MailMessage {
  const template = emailChangeTemplates[locale]
  return { to, subject: template.subject, text: renderBody(template, link) }
}
