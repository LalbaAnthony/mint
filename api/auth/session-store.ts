import session from 'express-session'
import type { SessionData } from 'express-session'
import { Op, QueryTypes } from 'sequelize'
import type { Sequelize } from 'sequelize'
import { log } from '../logger.js'
import { persistedSessionSchema } from '../schemas/session.js'
import type { Clock } from '../types/clock.js'
import type { Models } from '../types/models.js'
import { sessionMaxAgeMs } from './session.js'

export const sessionTouchIntervalMs = 60_000

function expirationOf(data: SessionData, now: Date): Date {
  return new Date(
    now.getTime() + (data.cookie.originalMaxAge ?? sessionMaxAgeMs),
  )
}

export class SequelizeSessionStore extends session.Store {
  readonly #sequelize: Sequelize
  readonly #models: Models
  readonly #clock: Clock

  constructor(sequelize: Sequelize, models: Models, clock: Clock) {
    super()
    this.#sequelize = sequelize
    this.#models = models
    this.#clock = clock
  }

  override get(
    sid: string,
    callback: (error: unknown, data?: SessionData | null) => void,
  ): void {
    this.#load(sid).then(
      (data) => callback(null, data),
      (error: unknown) => callback(error),
    )
  }

  override set(
    sid: string,
    data: SessionData,
    callback?: (error?: unknown) => void,
  ): void {
    this.#save(sid, data).then(
      () => callback?.(),
      (error: unknown) => callback?.(error),
    )
  }

  override touch(
    sid: string,
    data: SessionData,
    callback?: (error?: unknown) => void,
  ): void {
    this.#touch(sid, data).then(
      () => callback?.(),
      (error: unknown) => callback?.(error),
    )
  }

  override destroy(sid: string, callback?: (error?: unknown) => void): void {
    this.#models.Session.destroy({ where: { sid } }).then(
      () => callback?.(),
      (error: unknown) => callback?.(error),
    )
  }

  async #load(sid: string): Promise<SessionData | null> {
    const row = await this.#models.Session.findOne({
      where: { sid, expiresAt: { [Op.gt]: this.#clock.now() } },
    })
    if (row === null) {
      return null
    }
    const parsed = persistedSessionSchema.safeParse(row.data)
    if (!parsed.success) {
      log('warn', 'session_data_invalid', { sessionId: row.id })
      await row.destroy()
      return null
    }
    return parsed.data
  }

  async #save(sid: string, data: SessionData): Promise<void> {
    if (typeof data.userId !== 'string') {
      throw new Error('Refusing to persist a session without an user')
    }
    const now = this.#clock.now()
    await this.#sequelize.query(
      `INSERT INTO sessions
         (sid, user_id, data, expires_at, user_agent, ip, last_seen_at)
       VALUES
         (:sid, :userId, CAST(:data AS jsonb), :expiresAt, :userAgent, :ip, :now)
       ON CONFLICT (sid) DO UPDATE SET
         data = EXCLUDED.data,
         expires_at = EXCLUDED.expires_at,
         last_seen_at = EXCLUDED.last_seen_at,
         updated_at = now()`,
      {
        type: QueryTypes.INSERT,
        replacements: {
          sid,
          userId: data.userId,
          data: JSON.stringify(data),
          expiresAt: expirationOf(data, now),
          userAgent: data.userAgent,
          ip: data.ip,
          now,
        },
      },
    )
  }

  async #touch(sid: string, data: SessionData): Promise<void> {
    const now = this.#clock.now()
    await this.#models.Session.update(
      {
        data,
        expiresAt: expirationOf(data, now),
        lastSeenAt: now,
      },
      {
        where: {
          sid,
          lastSeenAt: {
            [Op.lt]: new Date(now.getTime() - sessionTouchIntervalMs),
          },
        },
      },
    )
  }
}
