const redis = require("redis");
const logger = require("../utils/logger");

class RedisService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
  }

  async connect() {
    try {
      const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
      
      this.client = redis.createClient({
        url: redisUrl,
        password: process.env.REDIS_PASSWORD,
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > this.maxReconnectAttempts) {
              logger.error("Redis: Max reconnection attempts reached");
              return new Error("Max reconnection attempts reached");
            }
            this.reconnectAttempts = retries;
            const delay = Math.min(retries * 100, 3000);
            logger.warn(`Redis: Reconnecting in ${delay}ms (attempt ${retries})`);
            return delay;
          },
        },
      });

      // Event handlers
      this.client.on("error", (err) => {
        logger.error({ err }, "Redis client error");
        this.isConnected = false;
      });

      this.client.on("connect", () => {
        logger.info("Redis: Connection established");
        this.reconnectAttempts = 0;
      });

      this.client.on("ready", () => {
        logger.info("Redis: Client ready");
        this.isConnected = true;
      });

      this.client.on("reconnecting", () => {
        logger.warn("Redis: Reconnecting...");
      });

      this.client.on("end", () => {
        logger.info("Redis: Connection closed");
        this.isConnected = false;
      });

      await this.client.connect();
      return true;
    } catch (error) {
      logger.error({ err: error }, "Failed to connect to Redis");
      this.isConnected = false;
      return false;
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      this.isConnected = false;
      logger.info("Redis: Disconnected");
    }
  }

  // Check if Redis is available
  isAvailable() {
    return this.isConnected && this.client;
  }

  // ==================== CACHE OPERATIONS ====================

  /**
   * Get value from cache
   */
  async get(key) {
    if (!this.isAvailable()) {
      logger.warn("Redis not available for GET operation");
      return null;
    }

    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error({ err: error, key }, "Redis GET error");
      return null;
    }
  }

  /**
   * Set value in cache with optional TTL
   */
  async set(key, value, ttlSeconds = 3600) {
    if (!this.isAvailable()) {
      logger.warn("Redis not available for SET operation");
      return false;
    }

    try {
      const serialized = JSON.stringify(value);
      await this.client.setEx(key, ttlSeconds, serialized);
      return true;
    } catch (error) {
      logger.error({ err: error, key }, "Redis SET error");
      return false;
    }
  }

  /**
   * Delete key from cache
   */
  async del(key) {
    if (!this.isAvailable()) return false;

    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      logger.error({ err: error, key }, "Redis DEL error");
      return false;
    }
  }

  /**
   * Delete multiple keys matching pattern
   */
  async delPattern(pattern) {
    if (!this.isAvailable()) return false;

    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
      }
      return true;
    } catch (error) {
      logger.error({ err: error, pattern }, "Redis DEL pattern error");
      return false;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key) {
    if (!this.isAvailable()) return false;

    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error({ err: error, key }, "Redis EXISTS error");
      return false;
    }
  }

  /**
   * Get remaining TTL for key
   */
  async ttl(key) {
    if (!this.isAvailable()) return -1;

    try {
      return await this.client.ttl(key);
    } catch (error) {
      logger.error({ err: error, key }, "Redis TTL error");
      return -1;
    }
  }

  // ==================== SESSION OPERATIONS ====================

  /**
   * Store session data
   */
  async setSession(sessionId, data, ttlSeconds = 86400) {
    return this.set(`session:${sessionId}`, data, ttlSeconds);
  }

  /**
   * Get session data
   */
  async getSession(sessionId) {
    return this.get(`session:${sessionId}`);
  }

  /**
   * Delete session
   */
  async delSession(sessionId) {
    return this.del(`session:${sessionId}`);
  }

  // ==================== RATE LIMITING ====================

  /**
   * Increment rate limit counter
   */
  async incrementRateLimit(key, windowSeconds = 60) {
    if (!this.isAvailable()) return null;

    try {
      const current = await this.client.incr(key);
      if (current === 1) {
        await this.client.expire(key, windowSeconds);
      }
      return current;
    } catch (error) {
      logger.error({ err: error, key }, "Redis rate limit error");
      return null;
    }
  }

  /**
   * Get rate limit counter
   */
  async getRateLimit(key) {
    if (!this.isAvailable()) return 0;

    try {
      const value = await this.client.get(key);
      return value ? parseInt(value, 10) : 0;
    } catch (error) {
      logger.error({ err: error, key }, "Redis get rate limit error");
      return 0;
    }
  }

  // ==================== CACHE WARMING & PATTERNS ====================

  /**
   * Cache with callback fallback
   */
  async cacheOrFetch(key, fetchFn, ttlSeconds = 3600) {
    // Try to get from cache
    const cached = await this.get(key);
    if (cached !== null) {
      logger.debug({ key }, "Cache hit");
      return cached;
    }

    // Cache miss - fetch and store
    logger.debug({ key }, "Cache miss");
    try {
      const data = await fetchFn();
      await this.set(key, data, ttlSeconds);
      return data;
    } catch (error) {
      logger.error({ err: error, key }, "Cache fetch error");
      throw error;
    }
  }

  /**
   * Invalidate cache for a resource
   */
  async invalidateResource(resourceType, resourceId) {
    const patterns = [
      `${resourceType}:${resourceId}`,
      `${resourceType}:${resourceId}:*`,
      `*:${resourceType}:${resourceId}`,
    ];

    for (const pattern of patterns) {
      await this.delPattern(pattern);
    }

    logger.debug({ resourceType, resourceId }, "Cache invalidated");
  }

  // ==================== HEALTH CHECK ====================

  async healthCheck() {
    if (!this.isAvailable()) {
      return {
        status: "down",
        message: "Redis client not connected",
      };
    }

    try {
      const start = Date.now();
      await this.client.ping();
      const latency = Date.now() - start;

      return {
        status: "up",
        latency: `${latency}ms`,
        connected: true,
      };
    } catch (error) {
      return {
        status: "down",
        error: error.message,
      };
    }
  }
}

// Export singleton instance
const redisService = new RedisService();
module.exports = redisService;
