import { Queue } from "bullmq";
import { logger } from "../lib/logger";
import { env } from "../config/env";

export const orderQueue = new Queue("process-order", {
  connection: { url: env.REDIS_URL },
  defaultJobOptions: {
    attempts: env.ORDER_MAX_ATTEMPTS,
    backoff: { type: "exponential", delay: env.ORDER_BACKOFF_MS },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  },
});

export async function enqueueOrder(orderId: string): Promise<void> {
  await orderQueue.add("process-order", { orderId }, { jobId: orderId });
  logger.info({ orderId }, "order.enqueued");
}
