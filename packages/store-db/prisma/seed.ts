import { prisma } from "../src";

const ERP_BASE_URL = process.env.ERP_BASE_URL ?? "http://erp:4000";
const SEED_MODE = process.env.SEED_MODE ?? "sync";

const STATIC_CATALOG = [
  { sku: "case-iphone-15",     name: "Capinha iPhone 15",        description: "Proteção slim com bordas elevadas.",                    priceCents: 7990,  stock: 50  },
  { sku: "case-iphone-14",     name: "Capinha iPhone 14",        description: "Compatível com MagSafe e carregadores sem fio.",        priceCents: 6990,  stock: 1   },
  { sku: "case-galaxy-s24",    name: "Capinha Galaxy S24",       description: "Design premium com proteção militar.",                  priceCents: 7490,  stock: 30  },
  { sku: "case-galaxy-a55",    name: "Capinha Galaxy A55",       description: "Leveza e resistência para o dia a dia.",                priceCents: 5990,  stock: 18  },
  { sku: "case-pixel-9",       name: "Capinha Pixel 9",          description: "Proteção total com bordas elevadas.",                   priceCents: 8490,  stock: 12  },
  { sku: "case-xiaomi-14",     name: "Capinha Xiaomi 14",        description: "Material premium com acabamento fosco.",                priceCents: 5490,  stock: 8   },
  { sku: "case-moto-g84",      name: "Capinha Moto G84",         description: "Proteção reforçada para quedas.",                      priceCents: 4990,  stock: 0   },
  { sku: "case-flaky-special", name: "Capinha Edição Instável",  description: "Edição limitada de colecionador.",                     priceCents: 9990,  stock: 100 },
  { sku: "case-asus-rog",      name: "Capinha Asus ROG Phone",   description: "Proteção gamer com design exclusivo.",                 priceCents: 10990, stock: 25  },
  { sku: "case-iphone-16", name: "Capinha iPhone 16", description: "Acabamento premium com proteção anti-impacto.", priceCents: 8990, stock: 1 },
  { sku: "case-galaxy-z-flip6", name: "Capinha Galaxy Z Flip6", description: "Proteção articulada para dobráveis.", priceCents: 11990, stock: 1 },
  { sku: "case-redmi-note-14", name: "Capinha Redmi Note 14", description: "Leve, resistente e com bordas elevadas para a tela.", priceCents: 5290, stock: 1 },
];

async function seedFromErp() {
  const resp = await fetch(`${ERP_BASE_URL}/erp/products`);
  if (!resp.ok) throw new Error(`ERP retornou ${resp.status}`);
  const products = (await resp.json()) as Array<{
    sku: string;
    name: string;
    description: string;
    priceCents: number;
    stock: number;
    imageUrl: string;
    active: boolean;
  }>;

  for (const p of products) {
    await prisma.$transaction(async (tx) => {
      await tx.product.upsert({
        where: { id: p.sku },
        update: {
          name: p.name,
          description: p.description,
          priceCents: p.priceCents,
          imageUrl: p.imageUrl,
          active: p.active,
          lastSyncedAt: new Date(),
        },
        create: {
          id: p.sku,
          name: p.name,
          description: p.description,
          priceCents: p.priceCents,
          imageUrl: p.imageUrl,
          active: p.active,
          lastSyncedAt: new Date(),
        },
      });

      const existing = await tx.inventory.findUnique({ where: { productId: p.sku } });
      const reserved = existing?.reserved ?? 0;
      const available = Math.max(0, p.stock - reserved);

      await tx.inventory.upsert({
        where: { productId: p.sku },
        update: { available, reserved },
        create: { productId: p.sku, available, reserved },
      });
    });
  }

  console.log(`Store seed (sync) — ${products.length} produtos sincronizados.`);
}

async function seedStatic() {
  for (const p of STATIC_CATALOG) {
    const imageUrl = `https://picsum.photos/seed/${p.sku}/600/600`;

    await prisma.$transaction(async (tx) => {
      await tx.product.upsert({
        where: { id: p.sku },
        update: {
          name: p.name,
          description: p.description,
          priceCents: p.priceCents,
          imageUrl,
          active: true,
          lastSyncedAt: new Date(),
        },
        create: {
          id: p.sku,
          name: p.name,
          description: p.description,
          priceCents: p.priceCents,
          imageUrl,
          active: true,
          lastSyncedAt: new Date(),
        },
      });

      const existing = await tx.inventory.findUnique({ where: { productId: p.sku } });
      const reserved = existing?.reserved ?? 0;
      const available = Math.max(0, p.stock - reserved);

      await tx.inventory.upsert({
        where: { productId: p.sku },
        update: { available, reserved },
        create: { productId: p.sku, available, reserved },
      });
    });
  }

  console.log(`Store seed (static) — ${STATIC_CATALOG.length} produtos inseridos.`);
}

async function main() {
  if (SEED_MODE === "static") {
    await seedStatic();
  } else {
    await seedFromErp();
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
