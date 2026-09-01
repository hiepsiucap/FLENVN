// OpenTelemetry must be registered before NestJS and its dependencies load.
// Keep it opt-in so developers without an OTLP endpoint do not get export errors.
require('dotenv').config({ quiet: true });

if (
  process.env.OTEL_SDK_DISABLED !== 'true' &&
  (process.env.OTEL_EXPORTER_OTLP_ENDPOINT ||
    process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT)
) {
  require('@opentelemetry/auto-instrumentations-node/register');
}
