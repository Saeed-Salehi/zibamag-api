module.exports = {
  apps: [
    {
      name: 'magazine-api',
      cwd: '.',
      script: 'yarn',
      args: 'start',
      interpreter: 'none',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        HOST: '127.0.0.1',
        PORT: 1337,
      },
      max_memory_restart: '512M',
    },
  ],
}
