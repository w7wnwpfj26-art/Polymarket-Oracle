/**
 * Structured Logger - Pino
 */

import pino from 'pino';
import { log as dbLog } from '../db/repository';

// Create Pino logger instance
const pinoLogger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    },
  },
});

// Logger categories
type LogCategory = 'system' | 'agent' | 'trade' | 'api' | 'db' | 'websocket' | 'ai';
type LogLevel = 'info' | 'warn' | 'error' | 'critical';

interface LogEntry {
  level: LogLevel;
  category: LogCategory;
  message: string;
  data?: Record<string, any>;
  timestamp: string;
}

class Logger {
  private category: LogCategory;

  constructor(category: LogCategory) {
    this.category = category;
  }

  private async _log(level: LogLevel, message: string, data?: Record<string, any>) {
    const entry: LogEntry = {
      level,
      category: this.category,
      message,
      data,
      timestamp: new Date().toISOString(),
    };

    // Log to console via Pino
    const pinoLevel = level === 'critical' ? 'fatal' : level;
    pinoLogger[pinoLevel]({ category: this.category, ...data }, message);

    // Log to database asynchronously (don't await to avoid blocking)
    const dbLevel = level.toUpperCase() as 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';
    dbLog(dbLevel, this.category, message, data).catch(() => {
      // Silently ignore DB logging errors to prevent infinite loops
    });
  }

  info(message: string, data?: Record<string, any>) {
    this._log('info', message, data);
  }

  warn(message: string, data?: Record<string, any>) {
    this._log('warn', message, data);
  }

  error(message: string, data?: Record<string, any>) {
    this._log('error', message, data);
  }

  critical(message: string, data?: Record<string, any>) {
    this._log('critical', message, data);
  }

  // Special method for timing operations
  time(label: string): () => void {
    const start = Date.now();
    return () => {
      const duration = Date.now() - start;
      this.info(`${label} completed`, { durationMs: duration });
    };
  }
}

// Create logger instances for each category
export const logger = {
  system: new Logger('system'),
  agent: new Logger('agent'),
  trade: new Logger('trade'),
  api: new Logger('api'),
  db: new Logger('db'),
  websocket: new Logger('websocket'),
  ai: new Logger('ai'),
};

// Default export for convenience
export default logger;
