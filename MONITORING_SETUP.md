# Production Monitoring Setup Guide
## Developer Collaboration Platform

This guide covers comprehensive monitoring setup for production environments.

---

## Table of Contents
1. [Application Logging](#application-logging)
2. [Error Tracking (Sentry)](#error-tracking-sentry)
3. [Performance Monitoring](#performance-monitoring)
4. [Uptime Monitoring](#uptime-monitoring)
5. [Database Monitoring](#database-monitoring)
6. [Log Aggregation](#log-aggregation)
7. [Alerting](#alerting)
8. [Dashboards](#dashboards)

---

## 1. Application Logging

### Configuration

The platform uses **Pino** for structured JSON logging with automatic log rotation.

**Location:** `server/src/utils/logger.js`

### Log Levels
```bash
# Development
LOG_LEVEL=debug

# Production
LOG_LEVEL=info
```

### Log Files (Production)
```
logs/
├── app.log          # Info level and above
└── error.log        # Error level only
```

### Log Rotation Setup

#### Using PM2
PM2 automatically rotates logs. Configure in `ecosystem.config.js`:
```javascript
log_date_format: "YYYY-MM-DD HH:mm:ss Z",
max_memory_restart: "1G",
```

#### Manual Rotation (logrotate)
```bash
# /etc/logrotate.d/devplatform
/path/to/app/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 nodejs nodejs
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
```

---

## 2. Error Tracking (Sentry)

### Setup

1. **Create Sentry Account**
   - Visit https://sentry.io
   - Create a new project (Node.js)
   - Copy the DSN

2. **Add to Environment Variables**
   ```bash
   SENTRY_DSN=https://your-dsn@sentry.io/project-id
   SENTRY_RELEASE=1.0.0
   ```

3. **Install Dependencies**
   ```bash
   npm install @sentry/node @sentry/profiling-node
   ```

4. **Already Integrated** ✅
   - Request handler in `app.js`
   - Error handler configured
   - Sensitive data redaction enabled

### Testing Sentry
```bash
# Trigger test error
curl -X POST http://localhost:5000/api/test-error
```

### Sentry Features Enabled
- ✅ Error tracking
- ✅ Performance monitoring (10% sample rate in production)
- ✅ Profiling
- ✅ MongoDB integration
- ✅ Express integration
- ✅ Breadcrumbs for debugging
- ✅ User context tracking

---

## 3. Performance Monitoring

### Built-in Health Checks

**Endpoints:**
```
GET /api/health              # Basic health (uptime, status)
GET /api/health/detailed     # With MongoDB, Redis, Socket.io status
GET /api/health/readiness    # Kubernetes readiness probe
GET /api/health/liveness     # Kubernetes liveness probe
```

### Monitoring Tools Options

#### Option A: PM2 Plus (Recommended for small teams)
```bash
# Install PM2 Plus module
pm2 install pm2-server-monit

# Link to PM2 Plus
pm2 link <secret> <public>

# View dashboard
https://app.pm2.io
```

**Features:**
- Real-time CPU/Memory monitoring
- Custom metrics
- Exception tracking
- Transaction tracing
- Free for up to 4 servers

#### Option B: New Relic
```bash
# Install agent
npm install newrelic

# Add to the TOP of server.js (before any other requires)
require('newrelic');

# Configure
cp node_modules/newrelic/newrelic.js ./
```

**Environment Variables:**
```bash
NEW_RELIC_LICENSE_KEY=your-license-key
NEW_RELIC_APP_NAME=Developer-Collaboration-Platform
NEW_RELIC_LOG_LEVEL=info
```

#### Option C: Prometheus + Grafana (Self-hosted)
```bash
# Install prometheus client
npm install prom-client

# Add metrics endpoint to app.js
# See implementation below
```

---

## 4. Uptime Monitoring

### Option A: UptimeRobot (Free, Recommended)

1. Sign up at https://uptimerobot.com
2. Add monitors:
   - **Main API:** https://yourapp.com/api/health (every 5 min)
   - **Frontend:** https://yourapp.com (every 5 min)
   - **WebSocket:** wss://yourapp.com/socket.io (advanced)

3. Configure alerts:
   - Email notifications
   - Slack/Discord webhook
   - SMS (premium)

### Option B: Pingdom
- More advanced features
- Multi-location checks
- Performance insights

### Option C: Self-hosted Uptime Kuma
```bash
docker run -d \
  --name uptime-kuma \
  -p 3001:3001 \
  -v uptime-kuma:/app/data \
  louislam/uptime-kuma:1
```

---

## 5. Database Monitoring

### MongoDB Monitoring

#### Enable Slow Query Logging
```javascript
// In MongoDB shell
db.setProfilingLevel(1, { slowms: 100 })

// View slow queries
db.system.profile.find().limit(10).sort({ ts: -1 }).pretty()
```

#### Monitor Connection Pool
```javascript
// Add to health check endpoint
const dbStats = await mongoose.connection.db.stats();
const connectionPool = mongoose.connection.client.topology.s.pool;

console.log({
  poolSize: connectionPool.totalConnectionCount,
  availableConnections: connectionPool.availableConnectionCount,
  waitQueueSize: connectionPool.waitQueueSize,
});
```

#### MongoDB Atlas (Cloud)
- Built-in monitoring dashboard
- Alerts on high CPU, storage, connections
- Performance Advisor for index recommendations

#### Self-hosted MongoDB Monitoring
```bash
# Install MongoDB Monitoring Agent
# https://docs.mongodb.com/ops-manager/

# Or use Prometheus mongodb_exporter
docker run -d \
  -p 9216:9216 \
  percona/mongodb_exporter:0.40 \
  --mongodb.uri=mongodb://localhost:27017
```

### Redis Monitoring

#### Redis CLI
```bash
# Monitor commands in real-time
redis-cli monitor

# Get info
redis-cli info

# Check memory usage
redis-cli info memory
```

#### Redis Stats in Health Check
Already implemented in `redisService.healthCheck()`:
```
GET /api/health/detailed
```

---

## 6. Log Aggregation

### Option A: ELK Stack (Elasticsearch, Logstash, Kibana)

**Docker Compose Setup:**
```yaml
version: '3.8'
services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.11.0
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
    ports:
      - "9200:9200"
    volumes:
      - es-data:/usr/share/elasticsearch/data

  logstash:
    image: docker.elastic.co/logstash/logstash:8.11.0
    volumes:
      - ./logstash.conf:/usr/share/logstash/pipeline/logstash.conf
    ports:
      - "5044:5044"
    depends_on:
      - elasticsearch

  kibana:
    image: docker.elastic.co/kibana/kibana:8.11.0
    ports:
      - "5601:5601"
    depends_on:
      - elasticsearch

volumes:
  es-data:
```

**Logstash Configuration (logstash.conf):**
```
input {
  file {
    path => "/path/to/app/logs/app.log"
    codec => "json"
    type => "app"
  }
}

filter {
  if [type] == "app" {
    json {
      source => "message"
    }
  }
}

output {
  elasticsearch {
    hosts => ["elasticsearch:9200"]
    index => "devplatform-%{+YYYY.MM.dd}"
  }
}
```

### Option B: CloudWatch Logs (AWS)
```bash
npm install winston-cloudwatch

# Configure in logger.js
const CloudWatchTransport = require('winston-cloudwatch');

logger.add(new CloudWatchTransport({
  logGroupName: 'devplatform-logs',
  logStreamName: 'production',
  awsRegion: 'us-east-1',
}));
```

### Option C: Papertrail (Simple SaaS)
```bash
# Add remote syslog transport
npm install winston-syslog

# Configure
logger.add(new winston.transports.Syslog({
  host: 'logs.papertrailapp.com',
  port: 12345,
}));
```

---

## 7. Alerting

### Critical Alerts to Configure

1. **Server Down**
   - Health check fails for 2 consecutive minutes
   - Alert: Email, SMS, PagerDuty

2. **High Error Rate**
   - Sentry: > 10 errors/minute
   - Alert: Email, Slack

3. **Database Issues**
   - MongoDB connections > 80%
   - Slow queries > 1000ms
   - Alert: Email

4. **High CPU/Memory**
   - CPU > 80% for 5 minutes
   - Memory > 90% for 3 minutes
   - Alert: Email

5. **Disk Space**
   - Disk usage > 85%
   - Alert: Email

### Alert Configuration Tools

#### PM2 Plus
- Built-in alerts for exceptions, CPU, memory
- Configure in dashboard

#### Prometheus Alertmanager
```yaml
# alertmanager.yml
route:
  receiver: 'team-email'
  group_by: ['alertname']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h

receivers:
- name: 'team-email'
  email_configs:
  - to: 'devops@yourcompany.com'
    from: 'alertmanager@yourcompany.com'
    smarthost: smtp.gmail.com:587
    auth_username: 'alertmanager@yourcompany.com'
    auth_password: 'password'
```

---

## 8. Dashboards

### Grafana Dashboard (Recommended)

#### Install Grafana
```bash
docker run -d \
  --name=grafana \
  -p 3000:3000 \
  grafana/grafana-oss:latest
```

#### Data Sources
1. Prometheus (application metrics)
2. MongoDB (database metrics)
3. Elasticsearch (logs)

#### Dashboard Panels

**Application Health:**
- Uptime
- Request rate (req/s)
- Response time (p50, p95, p99)
- Error rate

**Database:**
- MongoDB connections
- Query performance
- Database size
- Redis memory usage

**System:**
- CPU usage
- Memory usage
- Disk I/O
- Network traffic

**Business Metrics:**
- Active users
- New signups
- Projects created
- Tasks completed

### Pre-built Dashboard
Import Grafana dashboard for Node.js apps:
- Dashboard ID: 11159 (Node.js Application Dashboard)

---

## Quick Setup Checklist

### Minimal Production Setup (30 minutes)
- [ ] Configure Sentry DSN in `.env`
- [ ] Set LOG_LEVEL=info in production
- [ ] Set up UptimeRobot for health checks
- [ ] Configure PM2 for process management
- [ ] Set up automated backups (see DEPLOYMENT_GUIDE.md)
- [ ] Configure email alerts for critical errors

### Recommended Setup (2-4 hours)
- [ ] All minimal setup items
- [ ] PM2 Plus for application monitoring
- [ ] MongoDB slow query logging
- [ ] Log rotation with logrotate
- [ ] Slack webhook for error notifications
- [ ] Weekly performance reviews

### Advanced Setup (1-2 days)
- [ ] All recommended setup items
- [ ] ELK stack for log aggregation
- [ ] Grafana dashboards
- [ ] Prometheus metrics
- [ ] PagerDuty integration
- [ ] Custom business metrics tracking

---

## Testing Your Monitoring

```bash
# 1. Test health endpoints
curl http://localhost:5000/api/health
curl http://localhost:5000/api/health/detailed

# 2. Test Sentry error tracking
# Trigger an error and check Sentry dashboard

# 3. Test uptime monitoring
# Stop server and verify you receive alert

# 4. Test log rotation
# Check logs directory for rotated files

# 5. Monitor during load test
npm run test:load
# Watch metrics in real-time
```

---

## Maintenance

### Daily
- Check error rate in Sentry
- Verify all services healthy

### Weekly
- Review slow queries
- Check disk space
- Update dependencies (security patches)
- Review performance metrics

### Monthly
- Analyze trends (traffic, errors, performance)
- Update monitoring thresholds
- Test backup restoration
- Review and update alerts

---

**Last Updated:** February 13, 2026  
**Next Review:** March 13, 2026
