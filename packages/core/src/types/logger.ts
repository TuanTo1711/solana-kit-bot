export type LogLevel = 'error' | 'warn' | 'info' | 'verbose' | 'debug' | 'silly'

export interface LoggerConfig {
  level?: LogLevel
  enableColors?: boolean
  moduleName?: string
}

export interface LogEntry {
  level: string
  message: string
  timestamp?: string
  moduleName?: string
  stack?: string
  [key: string]: any
}
