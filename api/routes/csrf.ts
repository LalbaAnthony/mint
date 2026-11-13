import { csrfTokenResponseSchema } from '@mint/shared/schemas/auth'
import { issueCsrfToken } from '../auth/csrf.js'
import { isSecureOrigin } from '../auth/session.js'
import { definePublicRoute } from '../http/route.js'
import { noBody, noParams } from '../schemas/http.js'

export const csrfRoute = definePublicRoute({
  method: 'get',
  path: '/csrf',
  summary: 'Issue the token to send in the X-CSRF-Token header',
  tag: 'auth',
  body: noBody,
  params: noParams,
  responses: {
    200: { description: 'CSRF token', schema: csrfTokenResponseSchema },
  },
  handle: ({ request, response, app }) => ({
    status: 200,
    body: {
      token: issueCsrfToken(request, response, {
        secret: app.config.sessionSecret,
        secureCookies: isSecureOrigin(app.config.appOrigin),
      }),
    },
  }),
})
