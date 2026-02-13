const redisService = require("../services/redisService");
const logger = require("../utils/logger");

/**
 * Cache middleware for GET requests
 * Usage: router.get('/endpoint', cache(300), controller)
 */
const cache = (ttlSeconds = 300) => {
  return async (req, res, next) => {
    // Only cache GET requests
    if (req.method !== "GET") {
      return next();
    }

    // Skip caching if Redis is not available
    if (!redisService.isAvailable()) {
      return next();
    }

    try {
      // Build cache key from path and query params
      const cacheKey = `api:${req.originalUrl || req.url}`;

      // Try to get cached response
      const cachedData = await redisService.get(cacheKey);

      if (cachedData) {
        logger.debug({ cacheKey }, "Serving from cache");
        return res.json(cachedData);
      }

      // Store original res.json function
      const originalJson = res.json.bind(res);

      // Override res.json to cache response
      res.json = (body) => {
        // Only cache successful responses
        if (res.statusCode >= 200 && res.statusCode < 300) {
          redisService.set(cacheKey, body, ttlSeconds).catch((err) => {
            logger.error({ err, cacheKey }, "Failed to cache response");
          });
        }
        return originalJson(body);
      };

      next();
    } catch (error) {
      logger.error({ err: error }, "Cache middleware error");
      next(); // Continue without caching on error
    }
  };
};

/**
 * Cache invalidation middleware
 * Automatically invalidates cache for a resource after mutation
 */
const invalidateCache = (resourceType) => {
  return async (req, res, next) => {
    // Store original res.json
    const originalJson = res.json.bind(res);

    // Override to invalidate cache after successful response
    res.json = async (body) => {
      // Only invalidate on successful mutations
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const resourceId = req.params.id || req.params.projectId || req.params.taskId;
        
        if (resourceId && redisService.isAvailable()) {
          await redisService.invalidateResource(resourceType, resourceId);
          logger.debug({ resourceType, resourceId }, "Cache invalidated");
        }

        // Also invalidate list endpoints
        await redisService.delPattern(`api:/${resourceType}*`);
      }

      return originalJson(body);
    };

    next();
  };
};

/**
 * User-specific cache middleware
 */
const userCache = (ttlSeconds = 300) => {
  return async (req, res, next) => {
    if (req.method !== "GET" || !redisService.isAvailable()) {
      return next();
    }

    try {
      const userId = req.user?.id || req.user?._id;
      if (!userId) {
        return next();
      }

      const cacheKey = `user:${userId}:${req.originalUrl || req.url}`;
      const cachedData = await redisService.get(cacheKey);

      if (cachedData) {
        logger.debug({ cacheKey }, "Serving from user cache");
        return res.json(cachedData);
      }

      const originalJson = res.json.bind(res);
      res.json = (body) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          redisService.set(cacheKey, body, ttlSeconds);
        }
        return originalJson(body);
      };

      next();
    } catch (error) {
      logger.error({ err: error }, "User cache middleware error");
      next();
    }
  };
};

module.exports = {
  cache,
  invalidateCache,
  userCache,
};
