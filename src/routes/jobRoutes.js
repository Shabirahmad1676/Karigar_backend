import express from "express";
import { getJobs, createJob } from "../controllers/jobController.js";
import { createBid } from "../controllers/bidController.js";
import { validateJobRequest, validateBidRequest } from "../middleware/validate.js";
import { authenticateToken } from "../middleware/authenticateToken.js";


const router = express.Router();

// Job Management Endpoints
router.get("/", authenticateToken, getJobs);
router.post("/", authenticateToken ,validateJobRequest, createJob);

// Nested Bid Management Endpoint
router.post("/:jobId/bids", authenticateToken, validateBidRequest, createBid);

export default router;
