import { Worker, Queue } from "bullmq";
import { processOrder } from "./jobs/process-order";
import { syncErp } from "./jobs/sync-erp";
import { reapReservations } from "./jobs/reservation-reaper";
import { logger } from "./lib/logger";
import { env } from "./config/env";
import { prisma } from "./lib/prisma";

// BullMQ v5: QueueScheduler foi removido. O scheduler está embutido na Queue.
const connection = { url: env.REDIS_URL };

// Worker principal: consome jobs de pedidos com concorrência 5
const orderWorker = new Worker("process-order", processOrder, {
  connection,
  concurrency: 5,
});

orderWorker.on("failed", (job, err) => {
  logger.warn(
    {
      jobId: job?.id,
      orderId: job?.data?.orderId,
      requestId: job?.data?.requestId ?? "req_unknown",
      idempotencyKey: job?.data?.idempotencyKey ?? "idem_unknown",
      err,
    },
    "bullmq.job.failed",
  );
});

orderWorker.on("error", (err) => {
  logger.error({ err }, "bullmq.orderWorker.error");
});

// Fila de manutenção para jobs repetíveis (sync-erp e reservation-reaper)
const maintenanceQueue = new Queue("maintenance", { connection });

async function scheduleRepeatable(): Promise<void> {
  // upsert dos jobs repetíveis — idempotente via jobId fixo
  await maintenanceQueue.upsertJobScheduler(
    "sync-erp",
    { every: env.SYNC_INTERVAL_MS },
    { name: "sync-erp", data: {} },
  );
  await maintenanceQueue.upsertJobScheduler(
    "reservation-reaper",
    { every: env.RESERVATION_REAPER_INTERVAL_MS },
    { name: "reservation-reaper", data: {} },
  );
}

const maintenanceWorker = new Worker(
  "maintenance",
  async (job) => {
    if (job.name === "sync-erp") await syncErp();
    else if (job.name === "reservation-reaper") await reapReservations();
  },
  { connection },
);

maintenanceWorker.on("error", (err) => {
  logger.error({ err }, "bullmq.maintenanceWorker.error");
});

// Graceful shutdown: fecha workers, filas e conexões de forma ordenada
async function shutdown(): Promise<void> {
  logger.info("Worker shutting down...");
  await orderWorker.close();
  await maintenanceWorker.close();
  await maintenanceQueue.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

// Inicialização
async function main(): Promise<void> {
  logger.info("Worker starting...");
  await scheduleRepeatable();

  // Sync imediato no boot para aquecer o catálogo Redis antes de aceitar pedidos
  try {
    await syncErp();
  } catch (err) {
    logger.warn({ err }, "Initial sync failed, will retry on next interval");
  }

  logger.info("Worker started");
}

main().catch((err) => {
  logger.error({ err }, "Worker startup failed");
  process.exit(1);
});
