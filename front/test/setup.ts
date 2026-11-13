import { beforeEach } from 'vitest'
import { signIn } from './session'

beforeEach(() => {
  signIn('user')
})
