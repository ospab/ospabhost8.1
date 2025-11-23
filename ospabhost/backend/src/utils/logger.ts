/**
 * Logger utility - логирование только в debug режиме
 * Управляется через NODE_ENV в .env файле
 */

const isDebug = process.env.NODE_ENV !== 'production';

export const logger = {
  log: (...args: any[]) => {
    if (isDebug) {
      console.log(...args);
    }
  },
  
  error: (...args: any[]) => {
    // Ошибки логируем всегда
    console.error(...args);
  },
  
  warn: (...args: any[]) => {
    if (isDebug) {
      console.warn(...args);
    }
  },
  
  info: (...args: any[]) => {
    if (isDebug) {
      console.info(...args);
    }
  },
  
  debug: (...args: any[]) => {
    if (isDebug) {
      console.debug(...args);
    }
  }
};

// WebSocket специфичные логи
export const wsLogger = {
  log: (message: string, ...args: any[]) => {
    if (isDebug) {
      console.log(`[WebSocket] ${message}`, ...args);
    }
  },
  
  error: (message: string, ...args: any[]) => {
    console.error(`[WebSocket] ${message}`, ...args);
  },
  
  warn: (message: string, ...args: any[]) => {
    if (isDebug) {
      console.warn(`[WebSocket] ${message}`, ...args);
    }
  }
};
