module.exports = {
  apps: [
    {
      name: 'aegis-backend',
      cwd: './backend',
      script: 'npx',
      args: 'tsx src/index.ts',
      env: {
        NODE_ENV: 'production',
        PORT: 7700,
        WS_PORT: 7701
      },
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000
    },
    {
      name: 'aegis-frontend',
      cwd: './frontend',
      script: 'npx',
      args: 'vite --host 0.0.0.0 --port 3008',
      env: {
        NODE_ENV: 'production'
      },
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000
    }
  ]
};
