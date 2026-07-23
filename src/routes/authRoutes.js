// src/routes/authRoutes.js
import express from "express";
import { register, login, updatePushToken } from "../controllers/authController.js";
import rateLimiter from "../middleware/rateLimiter.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", rateLimiter, login);
router.post("/push-token", authMiddleware, updatePushToken);

export default router;
