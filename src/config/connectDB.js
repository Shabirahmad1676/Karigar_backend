import prisma from "../lib/prisma.js";

export async function connectDB(retries = 10) {
  while (retries > 0) {
    try {
      await prisma.$connect();

      console.log("✅ Database connected");

      return;
    } catch (error) {
      console.log(
        `❌ Database not ready. Retries left: ${retries}`
      );

      retries--;

      await new Promise((resolve) =>
        setTimeout(resolve, 5000)
      );
    }
  }

  throw new Error("Database connection failed");
}