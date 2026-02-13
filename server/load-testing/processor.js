// Artillery processor for custom logic and metrics

module.exports = {
  // Generate random string
  randomString,
  // Generate random number between min and max
  randomNumber,
  // Process environment variables
  processEnvironment,
  // Custom metrics collection
  trackCustomMetrics,
  // Before request hook
  beforeRequest,
  // After response hook
  afterResponse
};

function randomString() {
  return Math.random().toString(36).substring(7);
}

function randomNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function processEnvironment(context, events, done) {
  context.vars.processEnvironment = process.env;
  return done();
}

function trackCustomMetrics(context, events, done) {
  // Custom metric tracking
  context.vars.startTime = Date.now();
  return done();
}

function beforeRequest(requestParams, context, ee, next) {
  // Add custom headers
  requestParams.headers = requestParams.headers || {};
  requestParams.headers['X-Load-Test'] = 'true';
  requestParams.headers['X-Request-ID'] = `${context.vars.$uuid}-${Date.now()}`;
  
  // Track request start time
  context.vars.requestStartTime = Date.now();
  
  return next();
}

function afterResponse(requestParams, response, context, ee, next) {
  // Calculate custom metrics
  const duration = Date.now() - context.vars.requestStartTime;
  
  // Emit custom metrics
  ee.emit('customStat', {
    stat: 'request.duration',
    value: duration
  });
  
  // Track slow requests (> 2s)
  if (duration > 2000) {
    ee.emit('customStat', {
      stat: 'slow.requests',
      value: 1
    });
  }
  
  // Track errors
  if (response.statusCode >= 400) {
    ee.emit('customStat', {
      stat: 'error.responses',
      value: 1
    });
  }
  
  return next();
}
