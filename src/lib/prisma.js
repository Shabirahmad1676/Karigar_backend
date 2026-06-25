import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

// 1. Initialize a native pg database connection socket pool 
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

// 2. Wrap it cleanly within the required Prisma 7 Driver Adapter instance
const adapter = new PrismaPg(pool);

// 3. Hand the adapter down to the main client generator constructor
const prisma = new PrismaClient({ adapter });

export default prisma;