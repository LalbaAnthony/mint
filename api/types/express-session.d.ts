import 'express-session'

declare module 'express-session' {
  interface SessionData {
    userId: string
    userAgent: string | null
    ip: string | null
  }
}
