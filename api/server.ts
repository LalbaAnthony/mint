import { createServer } from 'node:http'
import { createApp } from './app.js'
import { createSequelize, isDatabaseReachable } from './db/sequelize.js'
import { parseEnvironment } from './environment.js'
import { describeError, log } from './logger.js'
import { serverEnvironmentSchema } from './schemas/environment.js'

function loadEnvironment() {
  try {
    return parseEnvironment(serverEnvironmentSchema, process.env)
  } catch (error) {
    log('error', 'api_environment_invalid', { error: describeError(error) })
    process.exit(1)
  }
}

const environment = loadEnvironment()
const sequelize = createSequelize(environment)
const server = createServer(
  createApp({ checkDatabase: () => isDatabaseReachable(sequelize) }),
)

function closeServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()))
  })
}

async function shutDown(signal: NodeJS.Signals): Promise<void> {
  log('info', 'api_stopping', { signal })
  try {
    await closeServer()
    await sequelize.close()
    log('info', 'api_stopped')
  } catch (error) {
    log('error', 'api_stop_failed', { error: describeError(error) })
    process.exitCode = 1
  }
}

server.once('error', (error) => {
  log('error', 'api_server_failed', { error: describeError(error) })
  process.exitCode = 1
})

server.listen(environment.PORT, () => {
  log('info', 'api_listening', { port: environment.PORT })
})

process.once('SIGTERM', (signal) => void shutDown(signal))
process.once('SIGINT', (signal) => void shutDown(signal))
