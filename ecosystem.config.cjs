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
      env_production: {
        NODE_ENV: 'production',
        AWS_REGION: 'ap-southeast-1',
        AUTO_LABELING_ENABLED: 'true',
        AUTO_LABELING_QUEUE_URL:
          'https://sqs.ap-southeast-1.amazonaws.com/490863269756/flenvn-prod-vocabulary-labeling',
        AUTO_LABELING_GEMINI_TIMEOUT_MS: '20000',
        AUTO_LABELING_PENDING_RECOVERY_MINUTES: '5',
      },
    },
  ],
};
