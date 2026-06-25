import { defineConfig } from "@prisma/config";

export default defineConfig({
  migrations: {
    seed: "node ./prisma/seed.js",
  },
  // Hardcode your local mapping port to point directly to the Docker PostgreSQL container
  datasource: {
    url: "postgresql://karigar_user:karigar_secure_password@db:5432/karigar_database?schema=public"
,
  },
});