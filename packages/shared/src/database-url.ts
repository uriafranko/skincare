const LEGACY_SSL_MODE_PATTERN = /([?&]sslmode=)(prefer|require|verify-ca)(&|$)/i;

/** Preserve the current strict TLS behavior across pg-connection-string upgrades. */
export function normalizePostgresConnectionString(connectionString: string): string {
  return connectionString.replace(LEGACY_SSL_MODE_PATTERN, "$1verify-full$3");
}
