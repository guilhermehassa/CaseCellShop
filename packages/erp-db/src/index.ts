export * from "./generated";
export { Prisma } from "./generated";
import { PrismaClient } from "./generated";
export const prisma = new PrismaClient();
