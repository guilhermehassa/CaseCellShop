import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  ERP_BASE_URL: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.string().default("info"),
  RESERVATION_TTL_MINUTES: z.coerce.number().int().positive().default(15),
  ORDER_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  ORDER_BACKOFF_MS: z.coerce.number().int().positive().default(2000),
  SYNC_INTERVAL_MS: z.coerce.number().int().positive().default(60000),
  RESERVATION_REAPER_INTERVAL_MS: z.coerce.number().int().positive().default(30000),
  DEBUG_HOOKS: z
    .string()
    .transform((v) => v === "true" || v === "1")
    .default("true"),
  CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(20),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
