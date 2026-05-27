import { prisma } from "../src";

const products = [
  {
    sku: "case-iphone-15",
    name: "Capinha iPhone 15",
    description: "Proteção slim com bordas elevadas.",
    priceCents: 7990,
    stock: 50,
    imageUrl: "https://picsum.photos/seed/case-iphone-15/600/600",
    active: true,
    flaky: false,
  },
  {
    sku: "case-iphone-14",
    name: "Capinha iPhone 14",
    description: "Encaixe preciso e acabamento fosco.",
    priceCents: 6990,
    stock: 1,
    imageUrl: "https://picsum.photos/seed/case-iphone-14/600/600",
    active: true,
    flaky: false,
  },
  {
    sku: "case-galaxy-s24",
    name: "Capinha Galaxy S24",
    description: "Material resistente a impactos leves.",
    priceCents: 7490,
    stock: 30,
    imageUrl: "https://picsum.photos/seed/case-galaxy-s24/600/600",
    active: true,
    flaky: false,
  },
  {
    sku: "case-galaxy-a55",
    name: "Capinha Galaxy A55",
    description: "Design ultrafino que preserva o estilo do aparelho.",
    priceCents: 5990,
    stock: 18,
    imageUrl: "https://picsum.photos/seed/case-galaxy-a55/600/600",
    active: true,
    flaky: false,
  },
  {
    sku: "case-pixel-9",
    name: "Capinha Pixel 9",
    description: "Proteção total com acesso a todos os botões.",
    priceCents: 8490,
    stock: 12,
    imageUrl: "https://picsum.photos/seed/case-pixel-9/600/600",
    active: true,
    flaky: false,
  },
  {
    sku: "case-xiaomi-14",
    name: "Capinha Xiaomi 14",
    description: "Silicone de alta qualidade com toque aveludado.",
    priceCents: 5490,
    stock: 8,
    imageUrl: "https://picsum.photos/seed/case-xiaomi-14/600/600",
    active: true,
    flaky: false,
  },
  {
    sku: "case-moto-g84",
    name: "Capinha Moto G84",
    description: "Capa protetora com reforço nas quinas.",
    priceCents: 4990,
    stock: 0,
    imageUrl: "https://picsum.photos/seed/case-moto-g84/600/600",
    active: true,
    flaky: false,
  },
  {
    sku: "case-flaky-special",
    name: "Capinha Edição Instável",
    description: "Edição limitada com acabamento especial exclusivo.",
    priceCents: 9990,
    stock: 100,
    imageUrl: "https://picsum.photos/seed/case-flaky-special/600/600",
    active: true,
    flaky: true,
  },
  {
    sku: "case-asus-rog",
    name: "Capinha Asus ROG Phone",
    description: "Proteção gamer com design agressivo e ventilação lateral.",
    priceCents: 10990,
    stock: 25,
    imageUrl: "https://picsum.photos/seed/case-asus-rog/600/600",
    active: true,
    flaky: false,
  },
];

async function main() {
  console.log("Iniciando seed do ERP...");

  for (const product of products) {
    await prisma.erpProduct.upsert({
      where: { sku: product.sku },
      update: {
        name: product.name,
        description: product.description,
        priceCents: product.priceCents,
        stock: product.stock,
        imageUrl: product.imageUrl,
        active: product.active,
        flaky: product.flaky,
      },
      create: product,
    });
    console.log(`  upsert: ${product.sku}`);
  }

  console.log(`Seed concluído — ${products.length} produtos.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
