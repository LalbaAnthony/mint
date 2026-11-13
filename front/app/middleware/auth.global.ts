export default defineNuxtRouteMiddleware(async (to) => {
  const session = useSessionStore()
  if (session.status === 'unknown') {
    await session.load()
  }
  const access = to.meta.access ?? 'user'
  if (access === 'public') {
    return
  }
  if (access === 'guest') {
    return session.status === 'authenticated' ? navigateTo('/') : undefined
  }
  if (session.status !== 'authenticated') {
    return navigateTo({
      path: '/login',
      query: to.fullPath === '/' ? {} : { redirect: to.fullPath },
    })
  }
  if (access === 'admin' && !session.isAdmin) {
    return navigateTo('/')
  }
})
