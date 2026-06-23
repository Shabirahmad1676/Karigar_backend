// server.js
import express from "express";
import http from "http";
import path from "path";
import dotenv from "dotenv";
import session from "express-session";
import { Server } from "socket.io";

// Component & Routing Imports
import authRoutes from "./src/routes/authRoutes.js";
import jobRoutes from "./src/routes/jobRoutes.js";
import serviceRoutes from "./src/routes/serviceRoutes.js";
import adminRoutes from "./src/routes/adminRoutes.js";

// Middleware & Configuration Core
import { initializeSocket } from "./src/socket/socket.js";
import { errorHandler } from "./src/middleware/errorHandler.js";
import redisClient from "./src/config/redis.js";
import { connectDB } from "./src/config/connectDB.js";

dotenv.config();

const app = express();
const server = http.createServer(app);

// 1. Template Engine & Views Mounting
app.set("view engine", "ejs");
app.set("views", path.resolve("views"));

// 2. Global Middleware Stack
app.use(express.json());
app.use("/uploads", express.static(path.resolve("uploads")));

app.use(session({
  secret: process.env.SESSION_SECRET || "karigar_session_fallback_secret",
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 24 Hours
}));

// 3. Socket.io Cluster Engine Initiation
const io = new Server(server, { cors: { origin: "*" } });
initializeSocket(io);

io.on("connection", (socket) => {
  console.log(`Client socket connected: ${socket.id}`);
  socket.on("disconnect", () => console.log(`Client disconnected: ${socket.id}`));
});

// 4. Modular Traffic Routing Bindings
app.use("/api/auth", authRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/services", serviceRoutes);
app.use("/admin", adminRoutes);

// health api
app.get("/api/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// 5. Global Exception Interceptor
app.use(errorHandler);

// 6. Redis In-Memory Client Startup Engine
try {
    if (!redisClient.isReady) {
        await redisClient.connect();
    }
} catch (redisError) {
    console.error("Failed to connect to Redis on startup:", redisError);
}

// 7. Microservice Port Deployment Loop
const PORT = process.env.PORT || 3000;
const startServer = async () => {
  try {
    await connectDB();
    server.listen(PORT, () => {
      console.log(`🚀 Karigar Engine online executing on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start application:", error.message);
    process.exit(1);
  }
};

startServer();