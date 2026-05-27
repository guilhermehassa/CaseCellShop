/**
 * Vitest global setup — sets minimal env vars so that env.ts (and logger.ts)
 * do not call process.exit(1) during module initialization in unit tests.
 *
 * These values are NOT real connections; unit tests mock all DB/Redis calls.
 */
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.REDIS_URL = "redis://localhost:6379";
process.env.ERP_BASE_URL = "http://localhost:4000";
process.env.PORT = "3000";
process.env.LOG_LEVEL = "silent";
process.env.RESERVATION_TTL_MINUTES = "15";
process.env.ORDER_MAX_ATTEMPTS = "5";
process.env.ORDER_BACKOFF_MS = "2000";
process.env.SYNC_INTERVAL_MS = "60000";
process.env.RESERVATION_REAPER_INTERVAL_MS = "30000";
process.env.DEBUG_HOOKS = "true";
process.env.CACHE_TTL_SECONDS = "20";
process.env.ERP_TIMEOUT_MS = "8000";
