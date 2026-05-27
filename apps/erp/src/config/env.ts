import { z } from "zod";

const envSchema = z.object({
  ERP_PORT: z
    .string()
    .optional()
    .default("4000")
    .transform((v) => parseInt(v, 10)),
  ERP_LOG_LEVEL: z.string().optional().default("info"),
  ERP_MIN_LATENCY_MS: z
    .string()
    .optional()
    .default("200")
    .transform((v) => parseInt(v, 10)),
  ERP_MAX_LATENCY_MS: z
    .string()
    .optional()
    .default("1500")
    .transform((v) => parseInt(v, 10)),
  ERP_FAILURE_RATE: z
    .string()
    .optional()
    .default("0.15")
    .transform((v) => parseFloat(v)),
  ERP_TIMEOUT_RATE: z
    .string()
    .optional()
    .default("0.05")
    .transform((v) => parseFloat(v)),
  ERP_TIMEOUT_MS: z
    .string()
    .optional()
    .default("8000")
    .transform((v) => parseInt(v, 10)),
  ERP_ALLOW_SCENARIO_HEADER: z
    .string()
    .optional()
    .default("true")
    .transform((v) => v.toLowerCase() !== "false"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:", parsed.error.flatten());
  process.exit(1);
}

export const env = parsed.data;
