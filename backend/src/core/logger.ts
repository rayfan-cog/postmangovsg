import winston from 'winston'
import config from '@core/config'

const getModuleLabel = (callingModule: NodeModule): string => {
  const moduleName = callingModule.filename
  // Get the subpath after the build dir without the file extension
  return moduleName.substring(
    moduleName.lastIndexOf('build') + 6,
    moduleName.lastIndexOf('.')
  )
}

const logger = winston.createLogger({
  level: 'debug',
  levels: winston.config.npm.levels,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.metadata(),
    winston.format.json({
      space: config.get('env') === 'development' ? 2 : 0,
    })
  ),
  transports: [new winston.transports.Console()],
})

export interface LogStream {
  write: (message: string) => void
}

const loggerStream: LogStream = {
  write: (message: string): void => {
    // use the 'info' log level so the output will be picked up by both transports
    logger.info(message)
  },
}

export const getStream = (): LogStream => {
  return loggerStream
}

export const addTransport = (transport: winston.transport): void => {
  logger.add(transport)
}

const truncate = (message: string, length: number, suffix = true): string => {
  if (!message) {
    return ''
  }
  return message.length > length
    ? `${message.substring(0, length)}${suffix ? '...<TRUNCATED>' : ''}`
    : message
}
export interface LogMeta {
  message?: string
  error?: unknown
  action?: string
  [key: string]: unknown
}

export interface LabeledLogger {
  log: (logMeta: LogMeta & { level: string; message: string }) => void
  info: (logMeta: LogMeta) => void
  error: (logMeta: LogMeta) => void
  debug: (logMeta: LogMeta) => void
  warn: (logMeta: LogMeta) => void
}

export const loggerWithLabel = (module: NodeModule): LabeledLogger => {
  const label = getModuleLabel(module)
  return {
    log: (logMeta) => logger.log({ label, ...logMeta }),
    info: (logMeta) => logger.info({ label, ...logMeta }),
    error: (logMeta) => {
      if (logMeta.error && logMeta.error instanceof Error) {
        logMeta.error = truncate(logMeta.error.stack ?? '', 400)
      }
      return logger.error({ label, ...logMeta })
    },

    debug: (logMeta) => logger.debug({ label, ...logMeta }),
    warn: (logMeta) => logger.warn({ label, ...logMeta }),
  }
}
