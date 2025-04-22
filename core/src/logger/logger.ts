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

const level = () => {
  // Check directly for LOG_LEVEL first
  if (process.env.LOG_LEVEL) {
    const logLevel = process.env.LOG_LEVEL.toLowerCase();
    // If debug level is set, automatically enable model debug too
    if (logLevel === 'debug') {
      process.env.DEBUG_LOGGING = 'true';
    }
    return logLevel;
  }

  // Fall back to NODE_ENV based logic
  const env = process.env.NODE_ENV || 'production';
  if (env === 'development') {
    process.env.DEBUG_LOGGING = 'true';
    return 'debug';
  }
  return 'info';
};

const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`
  )
);
let transports;
try {
  transports = [
    new winston.transports.Console(),

    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
    }),

    new winston.transports.File({ filename: 'logs/combined.log' }),
  ];
} catch (error) {
  transports = [new winston.transports.Console()];
}

const logger = winston.createLogger({
  level: level(),
  levels,
  format,
  transports,
});

export default logger;
