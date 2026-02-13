const pino = require("pino");
const path = require("path");

// Determine if we're in production
const isProduction = process.env.NODE_ENV === "production";
const isDevelopment = process.env.NODE_ENV === "development";
const isTest = process.env.NODE_ENV === "test";

// Configure transport for production (file + rotation)
const transport = isProduction
  ? {
      targets: [
        {
          target: "pino/file",
          options: {
            destination: path.join(process.cwd(), "logs", "app.log"),
            mkdir: true,
          },
          level: "info",
        },
        {
          target: "pino/file",
          options: {
            destination: path.join(process.cwd(), "logs", "error.log"),
            mkdir: true,
          },
          level: "error",
        },
      ],
    }
  : undefined;

// Configure logger options
const loggerOptions = {
  level: process.env.LOG_LEVEL || (isProduction ? "info" : "debug"),
  
  // Pretty print in development
  transport: !isProduction && !isTest
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "HH:MM:ss Z",
          ignore: "pid,hostname",
        },
      }
    : transport,

  // Base properties
  base: {
    env: process.env.NODE_ENV,
    ...(isProduction && { hostname: require("os").hostname() }),
  },

  // Timestamp
  timestamp: pino.stdTimeFunctions.isoTime,

  // Serializers for sensitive data
  serializers: {
    req: (req) => ({
      id: req.id,
      method: req.method,
      url: req.url,
      remoteAddress: req.remoteAddress,
      remotePort: req.remotePort,
    }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err,
  },

  // Redact sensitive fields
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "password",
      "token",
      "accessToken",
      "refreshToken",
      "*.password",
      "*.token",
    ],
    remove: true,
  },

  // Silence logs during tests
  enabled: !isTest || process.env.LOG_TESTS === "true",
};

const logger = pino(loggerOptions);

// Add custom log methods
logger.audit = (data) => logger.info({ type: "audit", ...data });
logger.security = (data) => logger.warn({ type: "security", ...data });
logger.performance = (data) => logger.debug({ type: "performance", ...data });

module.exports = logger;
