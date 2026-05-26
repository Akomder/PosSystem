/**
 * PM2 Ecosystem Config
 *
 * Usage:
 *   pm2 start ecosystem.config.js --env production
 *   pm2 save && pm2 startup
 */
module.exports = {
  apps: [
    {
      name:        'pos-server',
      script:      'server.js',
      cwd:         './server',
      instances:   'max',          // one process per CPU core
      exec_mode:   'cluster',      // enable load balancing
      watch:       false,
      max_memory_restart: '512M',

      // Environment — development
      env: {
        NODE_ENV: 'development',
        PORT:     3001,
      },

      // Environment — production (used with --env production)
      env_production: {
        NODE_ENV: 'production',
        PORT:     3001,
        // These must be set in your server's real environment or a .env file:
        // DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
        // JWT_SECRET, JWT_REFRESH_SECRET
        // CLIENT_ORIGIN
        // SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
      },

      // Logging
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file:      './logs/pm2-error.log',
      out_file:        './logs/pm2-out.log',
      merge_logs:      true,
    },
  ],
}
