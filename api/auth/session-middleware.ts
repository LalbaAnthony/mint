import session from 'express-session'
import type { RequestHandler } from 'express'
import type { AppDependencies } from '../types/app.js'
import {
  isSecureOrigin,
  sessionCookieName,
  sessionMaxAgeMs,
} from './session.js'
import { SequelizeSessionStore } from './session-store.js'

export function createSessionMiddleware(app: AppDependencies): RequestHandler {
  const secure = isSecureOrigin(app.config.appOrigin)
  return session({
    name: sessionCookieName(secure),
    secret: app.config.sessionSecret,
    store: new SequelizeSessionStore(app.sequelize, app.models, app.clock),
    resave: false,
    saveUninitialized: false,
    rolling: true,
    unset: 'destroy',
    cookie: {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge: sessionMaxAgeMs,
    },
  })
}
