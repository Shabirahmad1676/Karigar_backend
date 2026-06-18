// server.js
import express from "express";
import authRoutes from "./src/routes/authRoutes.js";
import jobRoutes from "./src/routes/jobRoutes.js";
import dotenv from "dotenv";
import prisma from "./src/lib/prisma.js";
import { Server } from "socket.io";
import http from "http";
dotenv.config(); // Load environment variables from .env file
import { initializeSocket } from "./src/socket/socket.js";
import {errorHandler} from "./src/middleware/errorHandler.js";
import serviceRoutes from "./src/routes/serviceRoutes.js";

const app = express();
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

initializeSocket(io);

io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});


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
app.use("/api/services", serviceRoutes);

app.use(errorHandler); // Global error handling middleware


const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
