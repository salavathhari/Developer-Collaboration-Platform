module.exports = {
  apps: [
    {
      name: 'devplatform-api',
      script: './src/server.js',
      
      // Instances
      instances: process.env.PM2_INSTANCES || 2,
      exec_mode: 'cluster',
      
      // Environment variables
      env: {
        NODE_ENV: 'development',
        PORT: 5000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000,
      },
      
      // Logging
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // Restart behavior
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      restart_delay: 4000,
      min_uptime: '10s',
      max_restarts: 10,
      
      // Advanced features
      listen_timeout: 10000,
      kill_timeout: 5000,
      shutdown_with_message: true,
      
      // Monitoring
      instance_var: 'INSTANCE_ID',
      
      // Graceful shutdown
      wait_ready: true,
      
      // Error handling
      exp_backoff_restart_delay: 100,
      
      // Node.js args
      node_args: '--max-old-space-size=2048',
      
      // Cron restart (optional - restart daily at 4 AM)
      cron_restart: '0 4 * * *',
    },
  ],
  
  deploy: {
    production: {
      user: 'deploy',
      host: ['your-production-server.com'],
      ref: 'origin/main',
      repo: 'git@github.com:your-username/Developer-Collaboration-Platform.git',
      path: '/var/www/devplatform',
      'post-deploy': 'npm install --production && pm2 reload ecosystem.config.js --env production',
      'pre-setup': 'git checkout main',
    },
    staging: {
      user: 'deploy',
      host: ['your-staging-server.com'],
      ref: 'origin/staging',
      repo: 'git@github.com:your-username/Developer-Collaboration-Platform.git',
      path: '/var/www/devplatform-staging',
      'post-deploy': 'npm install --production && pm2 reload ecosystem.config.js --env staging',
    },
  },
};
