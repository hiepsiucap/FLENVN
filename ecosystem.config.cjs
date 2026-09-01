module.exports = {
  apps: [
    {
      name: 'flenvn-api',
      script: 'dist/main.js',
      node_args: '-r ./scripts/register-tracing.cjs',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
