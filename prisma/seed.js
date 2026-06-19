import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seeding...");

  // 1. Create an Initial Admin User
  const adminEmail = "admin@karigar.com";
  const hashedPassword = await bcrypt.hash("AdminPassword123", 10);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      name: "Super Admin",
      email: adminEmail,
      phone: "03001234567",
      password: hashedPassword,
      role: "ADMIN",
    },
  });
  console.log(`✅ Admin user seeded: ${admin.email}`);

  // 2. Create Active Services Categories
  const coreServices = [
    { name: "Electrical Wiring & Repair", category: "Electrician", priceType: "CUSTOM" },
    { name: "Leakage Repair & Plumbing", category: "Plumber", priceType: "CUSTOM" },
    { name: "AC Installation & Servicing", category: "HVAC Tech", priceType: "FIXED" },
    { name: "Home Carpentry & Woodwork", category: "Carpenter", priceType: "CUSTOM" },
  ];

  for (const service of coreServices) {
    await prisma.service.upsert({
      where: { name: service.name },
      update: {},
      create: {
        name: service.name,
        category: service.category,
        priceType: service.priceType,
        isActive: true,
      },
    });
  }
  console.log("✅ Core service listings seeded successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });