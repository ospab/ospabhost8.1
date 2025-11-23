/**
 * Logger utility для frontend - логирование только в development режиме
 */

const isDebug = import.meta.env.MODE === 'development';

export const logger = {
  log: (...args: unknown[]) => {
    if (isDebug) {
      console.log(...args);
    }
  },
  
  error: (...args: unknown[]) => {
    // Ошибки логируем всегда
    console.error(...args);
  },
  
  warn: (...args: unknown[]) => {
    if (isDebug) {
      console.warn(...args);
    }
  },
  
  info: (...args: unknown[]) => {
    if (isDebug) {
      console.info(...args);
    }
  }
};

// WebSocket специфичные логи
export const wsLogger = {
  log: (message: string, ...args: unknown[]) => {
    if (isDebug) {
      console.log(`[WS] ${message}`, ...args);
    }
  },
  
  error: (message: string, ...args: unknown[]) => {
    console.error(`[WS] ${message}`, ...args);
  },
  
  warn: (message: string, ...args: unknown[]) => {
    if (isDebug) {
      console.warn(`[WS] ${message}`, ...args);
    }
  }
};
