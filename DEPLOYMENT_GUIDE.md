# Production Deployment Guide
## Developer Collaboration Platform

**Last Updated:** February 13, 2026  
**Version:** 1.0.0

---

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Pre-Deployment Checklist](#pre-deployment-checklist)
3. [Environment Setup](#environment-setup)
4. [Docker Deployment](#docker-deployment)
5. [Manual Deployment](#manual-deployment)
6. [Post-Deployment Verification](#post-deployment-verification)
7. [Monitoring & Maintenance](#monitoring--maintenance)
8. [Rollback Procedures](#rollback-procedures)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### System Requirements
- **Server**: Ubuntu 20.04+ / CentOS 8+ / Amazon Linux 2
- **CPU**: 2+ cores recommended
- **RAM**: 4GB minimum, 8GB recommended
- **Disk**: 20GB+ available space
- **Network**: Static IP or domain name

### Required Software
```bash
# Docker & Docker Compose
Docker Engine: 20.10+
Docker Compose: 2.0+

# OR for manual deployment
Node.js: 22.x
MongoDB: 7.0+
Redis: 7.0+
Nginx: 1.20+ (for reverse proxy)
PM2: Latest (process manager)
```

### External Services
- ✅ SMTP server (Gmail/SendGrid/AWS SES)
- ✅ (Optional) AWS S3 for file storage
- ✅ (Optional) Sentry account for error tracking
- ✅ Domain name with SSL certificate

---

## Pre-Deployment Checklist

### Security
- [ ] Strong JWT secrets generated (64+ characters)
- [ ] MongoDB authentication enabled
- [ ] Redis password set
- [ ] All `.env` files excluded from git
- [ ] SSL/TLS certificates obtained (Let's Encrypt)
- [ ] Firewall configured (ports 80, 443 only)
- [ ] Rate limiting configured
- [ ] npm audit run and vulnerabilities fixed

### Configuration
- [ ] `.env` file created from `.env.example`
- [ ] SMTP credentials tested
- [ ] Database backup strategy defined
- [ ] Monitoring tools configured (Sentry, etc.)
- [ ] Domain DNS records configured
- [ ] CDN configured (optional - Cloudflare/AWS CloudFront)

### Testing
- [ ] All unit tests passing
- [ ] Integration tests passing
- [ ] Load testing completed
- [ ] Security audit completed

---

## Environment Setup

### 1. Clone Repository
```bash
# On your production server
git clone https://github.com/your-username/Developer-Collaboration-Platform.git
cd Developer-Collaboration-Platform
```

### 2. Configure Environment Variables
```bash
# Copy example environment file
cp .env.example .env

# Edit with your production values
nano .env
```

**Critical Variables to Set:**
```bash
# Generate strong secrets
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Update .env with generated secrets
JWT_SECRET=<generated-secret-1>
JWT_REFRESH_SECRET=<generated-secret-2>
SESSION_SECRET=<generated-secret-3>

# Database
MONGO_ROOT_PASSWORD=<strong-password>
REDIS_PASSWORD=<strong-password>

# Email
SMTP_HOST=smtp.gmail.com
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-specific-password

# Frontend URL
FRONTEND_URL=https://your-domain.com
VITE_API_URL=https://api.your-domain.com
```

### 3. SSL Certificates (Let's Encrypt)
```bash
# Install Certbot
sudo apt update
sudo apt install certbot python3-certbot-nginx

# Obtain certificates
sudo certbot --nginx -d your-domain.com -d api.your-domain.com
```

---

## Docker Deployment

### 1. Install Docker & Docker Compose
```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify installations
docker --version
docker-compose --version
```

### 2. Build and Start Services
```bash
# Build images
docker-compose build

# Start services in detached mode
docker-compose up -d

# Verify all containers are running
docker-compose ps
```

### 3. Database Initialization
```bash
# Create MongoDB indexes
docker-compose exec backend node scripts/create-indexes.js

# (Optional) Seed initial data
docker-compose exec backend npm run seed
```

### 4. View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f mongo
```

### 5. Stop Services
```bash
# Stop all services
docker-compose down

# Stop and remove volumes (WARNING: deletes data)
docker-compose down -v
```

---

## Manual Deployment

### 1. Install Dependencies

#### MongoDB
```bash
# Import MongoDB GPG key
wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -

# Add repository
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

# Install
sudo apt update
sudo apt install -y mongodb-org

# Start and enable
sudo systemctl start mongod
sudo systemctl enable mongod

# Secure MongoDB
mongo
> use admin
> db.createUser({user: "admin", pwd: "your_password", roles: ["root"]})
> exit

# Enable authentication in /etc/mongod.conf
security:
  authorization: enabled
```

#### Redis
```bash
sudo apt install redis-server
sudo systemctl start redis
sudo systemctl enable redis

# Set password in /etc/redis/redis.conf
requirepass your_redis_password
```

#### Node.js
```bash
# Install Node.js 22.x
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify
node --version
npm --version
```

### 2. Install PM2
```bash
sudo npm install -g pm2

# Setup PM2 to start on boot
pm2 startup
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp $HOME
```

### 3. Build and Deploy Backend
```bash
cd server

# Install dependencies
npm ci --only=production

# Start with PM2
pm2 start src/server.js --name devplatform-backend --instances 2 --exec-mode cluster

# Save PM2 configuration
pm2 save
```

### 4. Build and Deploy Frontend
```bash
cd ../client

# Install dependencies and build
npm ci
npm run build

# Serve with Nginx
sudo cp nginx.conf /etc/nginx/sites-available/devplatform
sudo ln -s /etc/nginx/sites-available/devplatform /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 5. Configure Nginx Reverse Proxy
```nginx
# /etc/nginx/sites-available/devplatform

server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # Frontend
    location / {
        root /var/www/devplatform/client/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:5000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket
    location /socket.io/ {
        proxy_pass http://localhost:5000/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

---

##Post-Deployment Verification

### 1. Health Checks
```bash
# Backend health
curl https://api.your-domain.com/api/health

# Expected: {"status":"ok","timestamp":"..."}

# Frontend
curl https://your-domain.com/health

# Expected: healthy
```

### 2. Database Connection
```bash
# Docker deployment
docker-compose exec backend node -e "const mongoose = require('mongoose'); mongoose.connect(process.env.MONGO_URI).then(() => console.log('Connected')).catch(err => console.error(err))"

# Manual deployment
cd server
node -e "require('dotenv').config(); const mongoose = require('mongoose'); mongoose.connect(process.env.MONGO_URI).then(() => console.log('Connected')).catch(err => console.error(err))"
```

### 3. API Endpoints Test
```bash
# Register a test user
curl -X POST https://api.your-domain.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","password":"TestPassword123!"}'

# Login
curl -X POST https://api.your-domain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"TestPassword123!"}'
```

### 4. Email Delivery Test
```bash
# Trigger password reset email
curl -X POST https://api.your-domain.com/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'

# Check email inbox
```

---

## Monitoring & Maintenance

### 1. Application Logs

#### Docker
```bash
# Real-time logs
docker-compose logs -f backend

# Last 100 lines
docker-compose logs --tail=100 backend
```

#### PM2
```bash
# View logs
pm2 logs devplatform-backend

# Monitor in real-time
pm2 monit
```

### 2. Performance Monitoring
```bash
# PM2 Dashboard
pm2 list
pm2 show devplatform-backend

# Docker stats
docker stats
```

### 3. Database Backups
```bash
# Create backup script: /opt/scripts/backup-mongo.sh
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/mongodb"
mkdir -p $BACKUP_DIR

docker-compose exec -T mongo mongodump \
  --username=$MONGO_ROOT_USER \
  --password=$MONGO_ROOT_PASSWORD \
  --authenticationDatabase=admin \
  --archive=$BACKUP_DIR/backup_$DATE.archive \
  --gzip

# Keep only last 7 days
find $BACKUP_DIR -name "backup_*.archive" -mtime +7 -delete
```

```bash
# Make executable
chmod +x /opt/scripts/backup-mongo.sh

# Schedule with cron (daily at 2 AM)
crontab -e
0 2 * * * /opt/scripts/backup-mongo.sh >> /var/log/mongodb-backup.log 2>&1
```

### 4. Updates and Upgrades
```bash
# Pull latest code
git pull origin main

# Rebuild and restart (Docker)
docker-compose build
docker-compose up -d

# Restart (PM2)
cd server && npm ci --only=production
pm2 reload devplatform-backend
```

---

## Rollback Procedures

### Docker Rollback
```bash
# Stop current deployment
docker-compose down

# Checkout previous version
git checkout <previous-commit-hash>

# Rebuild and start
docker-compose build
docker-compose up -d
```

### PM2 Rollback
```bash
# Checkout previous version
git checkout <previous-commit-hash>

#Reinstall dependencies
cd server && npm ci --only=production

# Restart application
pm2 reload devplatform-backend
```

### Database Rollback
```bash
# Restore from backup
docker-compose exec -T mongo mongorestore \
  --username=$MONGO_ROOT_USER \
  --password=$MONGO_ROOT_PASSWORD \
  --authenticationDatabase=admin \
  --archive=/backups/mongodb/backup_<timestamp>.archive \
  --gzip \
  --drop
```

---

## Troubleshooting

### Container Won't Start
```bash
# Check logs
docker-compose logs backend

# Common issues:
# - Port already in use: Change port in .env
# - Database connection failed: Check MONGO_URI
# - Permission denied: Check file ownership
```

### High Memory Usage
```bash
# Check Node.js memory
docker stats backend

# Restart if needed
docker-compose restart backend

# Increase memory limit in docker-compose.yml
services:
  backend:
    deploy:
      resources:
        limits:
          memory: 2G
```

### Slow Database Queries
```bash
# Enable MongoDB profiling
docker-compose exec mongo mongosh
> use devplatform
> db.setProfilingLevel(1, { slowms: 100 })

# View slow queries
> db.system.profile.find().limit(5).sort({ ts: -1 }).pretty()
```

### WebSocket Connection Issues
```bash
# Check nginx logs
sudo tail -f /var/log/nginx/error.log

# Verify Upgrade headers
curl -i -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: test" \
  https://api.your-domain.com/socket.io/
```

---

## Production Checklist Summary

### Before Launch
- [ ] Load testing completed (Artillery)
- [ ] Security audit passed
- [ ] SSL certificates installed
- [ ] Monitoring configured (Sentry)
- [ ] Backup strategy implemented
- [ ] DNS configured correctly
- [ ] Rate limiting tested
- [ ] Error pages customized

### Post-Launch
- [ ] Health checks monitoring
- [ ] Error rate monitoring
- [ ] Performance metrics tracking
- [ ] User feedback collection
- [ ] Backup verification
- [ ] Security scanner running (daily)

---

## Support & Resources

- **Documentation:** https://github.com/your-repo/docs
- **Issues:** https://github.com/your-repo/issues
- **Monitoring Dashboard:** https://sentry.io/your-organization
- **Status Page:** https://status.your-domain.com

---

**Deployment Completed:** _______________________  
**Deployed By:** _______________________  
**Production URL:** _______________________  
**Notes:** _______________________
