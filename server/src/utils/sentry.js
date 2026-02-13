const Sentry = require("@sentry/node");
const { ProfilingIntegration } = require("@sentry/profiling-node");
const logger = require("./logger");

/**
 * Initialize Sentry error tracking
 * Call this before Express app initialization
 */
function initSentry(app) {
  const dsn = process.env.SENTRY_DSN;
  const environment = process.env.NODE_ENV || "development";
  
  // Only enable Sentry if DSN is configured
  if (!dsn) {
    logger.warn("Sentry DSN not configured. Error tracking disabled.");
    return;
  }

  if (environment === "test") {
    logger.info("Sentry disabled in test environment");
    return;
  }

  try {
    Sentry.init({
      dsn,
      environment,
      
      // Performance monitoring
      tracesSampleRate: environment === "production" ? 0.1 : 1.0,
      
      // Profiling
      profilesSampleRate: environment === "production" ? 0.1 : 1.0,
      integrations: [
        // Express integration
        new Sentry.Integrations.Http({ tracing: true }),
        new Sentry.Integrations.Express({ app }),
        new Sentry.Integrations.Mongo(),
        new ProfilingIntegration(),
      ],

      // Release tracking (use git commit or version)
      release: process.env.SENTRY_RELEASE || process.env.npm_package_version,

      // Before sending errors, sanitize sensitive data
      beforeSend(event, hint) {
        // Remove sensitive headers
        if (event.request && event.request.headers) {
          delete event.request.headers.authorization;
          delete event.request.headers.cookie;
        }

        // Remove sensitive data from extra context
        if (event.extra) {
          delete event.extra.password;
          delete event.extra.token;
          delete event.extra.accessToken;
          delete event.extra.refreshToken;
        }

        // Log error locally as well
        logger.error({
          error: hint.originalException || hint.syntheticException,
          eventId: event.event_id,
        }, "Error sent to Sentry");

        return event;
      },

      // Ignore specific errors
      ignoreErrors: [
        // Browser errors
        "Navigation timeout",
        "NetworkError",
        
        // Common not-found errors
        "NotFoundError",
        "SequelizeConnectionError",
        
        // Spam/bot errors
        /wp-admin/,
        /wp-login/,
      ],
    });

    logger.info("Sentry initialized successfully");
  } catch (error) {
    logger.error({ err: error }, "Failed to initialize Sentry");
  }
}

/**
 * Request handler - must be first middleware
 */
function sentryRequestHandler() {
  return Sentry.Handlers.requestHandler({
    user: ["id", "email", "name"],
    ip: true,
  });
}

/**
 * Tracing handler - for performance monitoring
 */
function sentryTracingHandler() {
  return Sentry.Handlers.tracingHandler();
}

/**
 * Error handler - must be before other error handlers
 */
function sentryErrorHandler() {
  return Sentry.Handlers.errorHandler({
    shouldHandleError(error) {
      // Send 4xx and 5xx errors to Sentry
      return error.status >= 400;
    },
  });
}

/**
 * Capture exception manually
 */
function captureException(error, context = {}) {
  Sentry.captureException(error, {
    extra: context,
  });
  logger.error({ err: error, context }, "Exception captured");
}

/**
 * Capture message
 */
function captureMessage(message, level = "info", context = {}) {
  Sentry.captureMessage(message, {
    level,
    extra: context,
  });
  logger[level]({ context }, message);
}

/**
 * Set user context for error tracking
 */
function setUser(user) {
  if (user) {
    Sentry.setUser({
      id: user.id || user._id,
      email: user.email,
      name: user.name,
    });
  } else {
    Sentry.setUser(null);
  }
}

/**
 * Add breadcrumb for debugging
 */
function addBreadcrumb(message, category, data = {}) {
  Sentry.addBreadcrumb({
    message,
    category,
    data,
    level: "info",
  });
}

module.exports = {
  initSentry,
  sentryRequestHandler,
  sentryTracingHandler,
  sentryErrorHandler,
  captureException,
  captureMessage,
  setUser,
  addBreadcrumb,
  Sentry,
};
