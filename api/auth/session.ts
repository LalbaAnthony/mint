import type { Request, Response } from 'express'
import type { AppDependencies } from '../types/app.js'
import type { UserModel } from '../types/models.js'

export const sessionMaxAgeMs = 30 * 24 * 60 * 60 * 1000

const userAgentMaxLength = 512

export function isSecureOrigin(origin: string): boolean {
  return origin.startsWith('https://')
}

export function sessionCookieName(secure: boolean): string {
  return secure ? '__Host-mint-session' : 'mint-session'
}

function runWithCallback(
  operation: (callback: (error: unknown) => void) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    operation((error) => {
      if (error) {
        reject(error)
        return
      }
      resolve()
    })
  })
}

export async function startUserSession(
  request: Request,
  user: UserModel,
): Promise<void> {
  await runWithCallback((done) => request.session.regenerate(done))
  request.session.userId = user.id
  request.session.userAgent =
    request.get('user-agent')?.slice(0, userAgentMaxLength) ?? null
  request.session.ip = request.ip ?? null
  await runWithCallback((done) => request.session.save(done))
}

export async function endSession(
  request: Request,
  response: Response,
  app: AppDependencies,
): Promise<void> {
  await runWithCallback((done) => request.session.destroy(done))
  const secure = isSecureOrigin(app.config.appOrigin)
  response.clearCookie(sessionCookieName(secure), {
    path: '/',
    httpOnly: true,
    secure,
    sameSite: 'lax',
  })
}

export async function revokeUserSessions(
  app: AppDependencies,
  userId: string,
): Promise<number> {
  return app.models.Session.destroy({ where: { userId } })
}
