import { describe, expect, it } from 'vitest'
import { isRouteActive } from '~/utils/routes'

describe('isRouteActive', () => {
  it.each([
    ['/', '/', true],
    ['/accounts', '/', false],
    ['/accounts', '/accounts', true],
    ['/accounts/42', '/accounts', true],
    ['/accountsx', '/accounts', false],
    ['/calendar', '/accounts', false],
  ])('%s matches %s: %s', (currentPath, target, expected) => {
    expect(isRouteActive(currentPath, target)).toBe(expected)
  })
})
