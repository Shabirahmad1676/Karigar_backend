// src/routes/authRoutes.js
import express from "express";
import { register, login } from "../controllers/authController.js";
import rateLimiter from "../middleware/rateLimiter.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", rateLimiter, login);

export default router;
