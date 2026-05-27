import { Request } from "express";
import { env } from "../config/env";
import { logger } from "./logger";

export type ChaosResult = "success" | "temporary_failure" | "timeout" | "reject";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export async function applyChaos(req: Request, flaky?: boolean): Promise<ChaosResult> {
  // 1. Header de cenário (prioridade máxima)
  if (env.ERP_ALLOW_SCENARIO_HEADER) {
    const scenario = req.headers["x-erp-scenario"] as string | undefined;
    if (scenario) {
      logger.debug({ scenario }, "X-Erp-Scenario header detected");
      switch (scenario) {
        case "success":
          return "success";
        case "temporary_failure":
          return "temporary_failure";
        case "timeout":
          await sleep(env.ERP_TIMEOUT_MS + 2000);
          return "timeout";
        case "reject":
          return "reject";
        default:
          logger.warn({ scenario }, "Unknown X-Erp-Scenario value, ignoring");
      }
    }
  }

  // 2. Produto flaky → sempre falha temporária
  if (flaky === true) {
    logger.debug("Product is flaky, injecting temporary_failure");
    return "temporary_failure";
  }

  // 3. Probabilístico
  const latencyMs = randomBetween(env.ERP_MIN_LATENCY_MS, env.ERP_MAX_LATENCY_MS);
  logger.debug({ latencyMs }, "Applying base latency");
  await sleep(latencyMs);

  const roll = Math.random();

  if (roll < env.ERP_TIMEOUT_RATE) {
    logger.debug({ roll, ERP_TIMEOUT_RATE: env.ERP_TIMEOUT_RATE }, "Chaos: timeout");
    await sleep(env.ERP_TIMEOUT_MS);
    return "timeout";
  }

  if (roll < env.ERP_TIMEOUT_RATE + env.ERP_FAILURE_RATE) {
    logger.debug({ roll }, "Chaos: temporary_failure");
    return "temporary_failure";
  }

  return "success";
}
