import { prisma } from "../src";

async function main() {
  console.log("Store seed placeholder — será preenchido no M2");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
