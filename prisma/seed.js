import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Purging old records and starting premium marketplace seeding...");

  // 1. Create Initial Admin User Account
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
  console.log(`✅ System administrator set: ${admin.email}`);

  // 2. High-Fidelity Categorical Hierarchy Matrix Configuration Data
  const marketplaceData = [
    {
      name: "Plumbing & Piping",
      iconName: "water-outline",
      services: [
        { name: "Fixing Leaky Faucets & Valves", priceType: "CUSTOM" },
        { name: "Unclogging Drains & Pipes", priceType: "CUSTOM" },
        { name: "Water Heater Repair & Install", priceType: "FIXED" },
        { name: "Water Tank Deep Cleaning", priceType: "FIXED" },
      ],
    },
    {
      name: "Electrical & Smart Home",
      iconName: "flash-outline",
      services: [
        { name: "Short Circuit Diagnostics & Wiring Repair", priceType: "CUSTOM" },
        { name: "Ceiling Fan & Lighting Installations", priceType: "FIXED" },
        { name: "Distribution Board & Panel Upgrades", priceType: "CUSTOM" },
        { name: "UPS & Inverter Calibration Setup", priceType: "FIXED" },
      ],
    },
    {
      name: "AC & HVAC Maintenance",
      iconName: "snow-outline",
      services: [
        { name: "Split AC Chemical Pressure Wash", priceType: "FIXED" },
        { name: "Gas Leakage Top-up Refilling", priceType: "CUSTOM" },
        { name: "Inverter AC Compressor System Installation", priceType: "FIXED" },
      ],
    },
    {
      name: "Carpentry & Assembly",
      iconName: "hammer-outline",
      services: [
        { name: "Flat-Pack Furniture Assembly (Bed, Wardrobe)", priceType: "FIXED" },
        { name: "Door Locks, Latches & Hinge Repairs", priceType: "FIXED" },
        { name: "Custom Wooden Cabinet Restoration", priceType: "CUSTOM" },
      ],
    },
    {
      name: "Cleaning & Upkeep",
      iconName: "sparkles-outline",
      services: [
        { name: "Full Home Deep Sanitization Cleaning", priceType: "FIXED" },
        { name: "Sofa & Carpet Shampoo Extraction", priceType: "FIXED" },
        { name: "Gutter Clearance & Pressure Washing", priceType: "CUSTOM" },
      ],
    },
    {
      name: "Painting & Refinishing",
      iconName: "brush-outline",
      services: [
        { name: "Interior Wall Painting & Touch-ups", priceType: "CUSTOM" },
        { name: "Exterior Siding Waterproof Refinishing", priceType: "CUSTOM" },
        { name: "Wall Putty Scraping & Priming Treatment", priceType: "CUSTOM" },
      ],
    },
    {
      name: "Gardening & Yard Care",
      iconName: "leaf-outline",
      services: [
        { name: "Lawn Mowing, Weeding & Grass Aeration", priceType: "FIXED" },
        { name: "Tree Shrub Trimming & Dead Branch Removal", priceType: "CUSTOM" },
      ],
    },
    {
      name: "Waste & Junk Removal",
      iconName: "trash-outline",
      services: [
        { name: "Debris & Construction Rubble Clearing", priceType: "CUSTOM" },
        { name: "Old Appliance & Unwanted Furniture Disposal", priceType: "FIXED" },
      ],
    },
  ];

  // 3. Relational Transactional Seeding Execution
  for (const sector of marketplaceData) {
    const createdCategory = await prisma.category.upsert({
      where: { name: sector.name },
      update: { iconName: sector.iconName },
      create: {
        name: sector.name,
        iconName: sector.iconName,
      },
    });

    for (const service of sector.services) {
      await prisma.service.upsert({
        where: { name: service.name },
        update: { priceType: service.priceType, categoryId: createdCategory.id },
        create: {
          name: service.name,
          priceType: service.priceType,
          categoryId: createdCategory.id,
        },
      });
    }
  }

  console.log("✅ High-Fidelity Categories and Sub-Services seeded smoothly on Karigar DB!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding runtime crash statement:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });