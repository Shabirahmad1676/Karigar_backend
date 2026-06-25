import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { enforceVerifiedTechnician } from "../middleware/authMiddleware.js";
import { createBid } from "../controllers/bidController.js";

const router = express.Router();

// Enforce authentication verification across all downstream route allocations
router.use(authMiddleware);

// Protect critical marketplace actions
router.post("/bids/:jobId", enforceVerifiedTechnician, createBid);

export default router;