import { prisma } from "../src";

async function main() {
  console.log("ERP seed placeholder — será preenchido no M1");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
