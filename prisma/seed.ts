import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { productSeedData } from "./product-seed-data";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  for (const product of productSeedData) {
    await prisma.product.upsert({
      where: { name: product.name },
      create: product,
      update: {
        category: product.category,
        cost: product.cost,
        price: product.price,
      },
    });
  }
  console.log(`Seeded ${productSeedData.length} products.`);

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@therightchoice.local";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "changeme123";
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  await prisma.user.upsert({
    where: { email: adminEmail },
    create: {
      name: "Admin",
      email: adminEmail,
      passwordHash,
      role: "admin",
    },
    update: {},
  });
  console.log(`Seeded admin user: ${adminEmail} / ${adminPassword}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
