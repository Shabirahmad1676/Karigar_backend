// server.js
import redisClient from "./src/config/redis.js";
import { connectDB } from "./src/config/connectDB.js";
import express from "express";
import cors from 'cors';
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import session from "express-session";
import { Server } from "socket.io"; // Added Socket.io importer back safely

// Component & Routing Imports
import authRoutes from "./src/routes/authRoutes.js";
import jobRoutes from "./src/routes/jobRoutes.js";
import serviceRoutes from "./src/routes/serviceRoutes.js";
import adminRoutes from "./src/routes/adminRoutes.js";
import technicianRoutes from "./src/routes/technicianRoutes.js";
import notificationRoutes from "./src/routes/notificationRoutes.js";
import chatRoutes from "./src/routes/chatRoutes.js";

// Middleware & Configuration Core
import { initializeSocket } from "./src/socket/socket.js";
import { errorHandler } from "./src/middleware/errorHandler.js";

dotenv.config();

const app = express();
const server = http.createServer(app); 
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ====== FIX: INITIALIZE SOCKET.IO ENGINE HERE ======
const io = new Server(server, { 
  cors: { 
    origin: "http://localhost:8081",
    methods: ["GET", "POST"]
  } 
}); 
initializeSocket(io); // Safely register all handlers once inside socket.js
// ===================================================

// Global request logger to watch incoming traffic live
app.use((req, res, next) => {
  console.log(`📡 INCOMING: ${req.method} ${req.url} - Content-Type: ${req.headers['content-type']}`);
  next();
});

app.use(cors({
  origin: 'http://localhost:8081', // Allows requests from your Expo web app
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'], // Allows Bearer token header
  credentials: true 
}));

// Global Middleware Stack
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Dynamic View Engine Path Configuration Alignment
app.set("view engine", "ejs");
app.set("views", path.join(process.cwd(), "src", "views"));

// Unified Static Asset Folder Handling
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

app.use(session({
  secret: process.env.SESSION_SECRET || "karigar_session_fallback_secret",
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 24 Hours
}));

// Modular Traffic Routing Bindings
app.use("/api/auth", authRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/services", serviceRoutes);
app.use("/admin", adminRoutes);
app.use("/api/technicians", technicianRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/chat", chatRoutes);

// Health API
app.get("/api/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// Global Exception Interceptor
app.use(errorHandler);

const PORT = process.env.PORT || 3000;

async function startServer() {
  // 1. Safe PostgreSQL connection verification
  try {
    await connectDB();
  } catch (dbErr) {
    console.error("💥 FAILED TO CONNECT TO DATABASE SCHEMA:", dbErr);
    process.exit(1);
  }
  
  // 2. Fail-safe asynchronous Redis connection block
  if (!redisClient.isOpen) {
    redisClient.connect()
      .then(() => console.log("🚀 Redis Client Connected Successfully"))
      .catch((redisErr) => {
        console.warn("⚠️ Non-Fatal Redis Connection Failure on boot:", redisErr.message);
        console.warn("🛡️ System running in fallback database-only state safely.");
      });
  }
  
  // 3. Mount the server process immediately on your network interface targets
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Karigar Fleet Engine completely initialized on port ${PORT}`);
  });
}

startServer().catch(err => {
  console.error("💥 CRITICAL FLEET RUNTIME INITIALIZATION FAILURE:", err);
  process.exit(1);
});
