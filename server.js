// server.js
import express from "express";
import authRoutes from "./src/routes/authRoutes.js";
import jobRoutes from "./src/routes/jobRoutes.js";
import dotenv from "dotenv";
import prisma from "./src/lib/prisma.js";
dotenv.config(); // Load environment variables from .env file

const app = express();
app.use(express.json());

app.get("/api/users",async(req,res)=>{
   try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });
    return res.json(users);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }

});

// Bind modular routers to root entry paths
app.use("/api/auth", authRoutes);
app.use("/api/jobs", jobRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
