const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const redisService = require('../services/redisService');

/**
 * @route   GET /api/health
 * @desc    Basic health check - service is running
 * @access  Public
 */
router.get('/', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
  });
});

/**
 * @route   GET /api/health/detailed
 * @desc    Detailed health check with dependencies
 * @access  Public (consider auth in production)
 */
router.get('/detailed', async (req, res) => {
  const healthcheck = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    services: {},
    resources: {
      memory: {
        used: Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100,
        total: Math.round((process.memoryUsage().heapTotal / 1024 / 1024) * 100) / 100,
        percentage: Math.round((process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100),
      },
      cpu: process.cpuUsage(),
    },
  };

  try {
    // Check MongoDB connection
    const mongoState = mongoose.connection.readyState;
    healthcheck.services.mongodb = {
      status: mongoState === 1 ? 'connected' : 'disconnected',
      readyState: mongoState,
      host: mongoose.connection.host,
      name: mongoose.connection.name,
    };

    // Check Redis connection (if configured)
    const redisHealth = await redisService.healthCheck();
    healthcheck.services.redis = redisHealth;
    
    if (redisHealth.status === 'down') {
      healthcheck.status = 'degraded';
    }

    // Check Socket.io
    if (global.io) {
      healthcheck.services.socketio = {
        status: 'active',
        connectedClients: global.io.engine.clientsCount || 0,
      };
    }

    // Overall health status
    if (mongoState !== 1) {
      healthcheck.status = 'unhealthy';
      return res.status(503).json(healthcheck);
    }

    res.status(200).json(healthcheck);
  } catch (error) {
    healthcheck.status = 'error';
    healthcheck.error = error.message;
    res.status(500).json(healthcheck);
  }
});

/**
 * @route   GET /api/health/readiness
 * @desc    Kubernetes readiness probe - can accept traffic
 * @access  Public
 */
router.get('/readiness', async (req, res) => {
  try {
    // Check critical dependencies
    const mongoReady = mongoose.connection.readyState === 1;
    
    if (!mongoReady) {
      return res.status(503).json({
        status: 'not_ready',
        reason: 'Database not connected',
      });
    }

    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'not_ready',
      error: error.message,
    });
  }
});

/**
 * @route   GET /api/health/liveness
 * @desc    Kubernetes liveness probe - process is alive
 * @access  Public
 */
router.get('/liveness', (req, res) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
