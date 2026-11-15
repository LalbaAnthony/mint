import { notificationLink } from '@mint/shared/engines/notifications'
import type {
  NotificationDraft,
  PushMessage,
} from '@mint/shared/types/notifications'
import type { Locale } from '@mint/shared/types/user'
import type { MessageFormatters } from '../types/notifications.js'

const intlLocales: Record<Locale, string> = { fr: 'fr-FR', en: 'en-GB' }

export function messageFormatters(locale: Locale): MessageFormatters {
  const money = new Intl.NumberFormat(intlLocales[locale], {
    style: 'currency',
    currency: 'EUR',
  })
  const date = new Intl.DateTimeFormat(intlLocales[locale], {
    dateStyle: 'medium',
    timeZone: 'UTC',
  })
  return {
    locale,
    money: (cents) => money.format(cents / 100),
    date: (isoDate) => date.format(new Date(`${isoDate}T00:00:00Z`)),
  }
}

function texts(
  draft: NotificationDraft,
  format: MessageFormatters,
): { title: string; body: string } {
  const french = format.locale === 'fr'
  switch (draft.type) {
    case 'low_balance': {
      const { accountName, minCents, minDate, thresholdCents } = draft.payload
      return french
        ? {
            title: `Solde bas : ${accountName}`,
            body: `${format.money(minCents)} prévus le ${format.date(minDate)}, sous le seuil de ${format.money(thresholdCents)}.`,
          }
        : {
            title: `Low balance: ${accountName}`,
            body: `${format.money(minCents)} expected on ${format.date(minDate)}, below the ${format.money(thresholdCents)} threshold.`,
          }
    }
    case 'manual_reminder': {
      const { scheduleLabel, amountCents, effectiveDate, dueToday } =
        draft.payload
      const amount = format.money(amountCents)
      if (french) {
        return {
          title: `Paiement à faire : ${scheduleLabel}`,
          body: dueToday
            ? `${amount} à régler aujourd'hui.`
            : `${amount} à régler le ${format.date(effectiveDate)}.`,
        }
      }
      return {
        title: `Payment to make: ${scheduleLabel}`,
        body: dueToday
          ? `${amount} to pay today.`
          : `${amount} to pay on ${format.date(effectiveDate)}.`,
      }
    }
    case 'deposit_cap': {
      const { accountName, excessCents, date } = draft.payload
      return french
        ? {
            title: `Plafond dépassé : ${accountName}`,
            body: `Dépassement de ${format.money(excessCents)} le ${format.date(date)}.`,
          }
        : {
            title: `Cap exceeded: ${accountName}`,
            body: `Exceeded by ${format.money(excessCents)} on ${format.date(date)}.`,
          }
    }
  }
}

export function pushMessage(
  draft: NotificationDraft,
  locale: Locale,
): PushMessage {
  return {
    ...texts(draft, messageFormatters(locale)),
    url: notificationLink(draft),
    tag: draft.dedupKey,
  }
}
