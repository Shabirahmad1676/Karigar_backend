import express from "express";
import { createJob, getMyJobs, getJobById, getAvailableJobs } from "../controllers/jobController.js";
import { uploadJobImage } from "../controllers/jobImageController.js";
import { acceptBid } from "../controllers/bidController.js"; // 👈 Keep only this one
import { authMiddleware } from "../middleware/authMiddleware.js";
import { validateJobRequest } from "../middleware/validate.js"; 
import { upload } from "../config/multer.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/available", getAvailableJobs);
router.post("/", validateJobRequest, createJob);
router.get("/my", getMyJobs);
router.get("/:id", getJobById);
router.post("/:id/image", upload.single("image"), uploadJobImage);

// This line matches your frontend call perfectly
router.post("/bids/:jobId/accept/:bidId", acceptBid);

export default router;