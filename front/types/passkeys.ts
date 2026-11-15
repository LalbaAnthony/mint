export type PasskeyCeremonyFailure = 'cancelled' | 'already_registered'

export type PasskeyFormState = {
  name: string
  password: string
}

export type AccountDeletionFormState = {
  email: string
  password: string
}
