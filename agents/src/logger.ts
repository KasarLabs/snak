import winston from 'winston';

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
};

winston.addColors(colors);

// Improved level selection based on environment variables
const level = () => {
  // Check for explicit LOG_LEVEL environment variable
  if (process.env.LOG_LEVEL) {
    return process.env.LOG_LEVEL.toLowerCase();
  }

  // Check for DEBUG_LOGGING environment variable
  if (process.env.DEBUG_LOGGING === 'true') {
    return 'debug';
  }

  // Fallback to NODE_ENV based selection
  const env = process.env.NODE_ENV || 'production';
  return env === 'development' ? 'debug' : 'info';
};

// Determine if logging should be enabled
const isLoggingEnabled = () => {
  return process.env.DISABLE_LOGGING !== 'true';
};

// Create a custom format that includes a visual marker for debug logs
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf((info) => {
    // Add a special marker for debug logs to make them more visible
    if (info.level.includes('debug')) {
      return `${info.timestamp} ${info.level}: [DEBUG] ${info.message}`;
    }
    return `${info.timestamp} ${info.level}: ${info.message}`;
  })
);

let transports;
try {
  if (!isLoggingEnabled()) {
    // If logging is disabled, use a silent console transport
    transports = [new winston.transports.Console({ silent: true })];
  } else {
    transports = [
      new winston.transports.Console(),
      new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
      }),
      new winston.transports.File({ filename: 'logs/combined.log' }),
    ];
  }
} catch (error) {
  transports = [new winston.transports.Console()];
}

const logger = winston.createLogger({
  level: level(),
  levels,
  format,
  transports,
});

// Add a startup message to verify logger configuration
if (isLoggingEnabled()) {
  setTimeout(() => {
    logger.debug(`Logger initialized with level: ${level()}`);
    logger.debug('Debug logging is enabled - you should see this message');
  }, 0);
}

export default logger;
