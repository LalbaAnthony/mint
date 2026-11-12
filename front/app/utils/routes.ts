export function isRouteActive(currentPath: string, target: string): boolean {
  if (target === '/') {
    return currentPath === '/'
  }
  return currentPath === target || currentPath.startsWith(`${target}/`)
}
