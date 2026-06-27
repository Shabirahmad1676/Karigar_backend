import express from "express";
// 1. ADD 'getAvailableJobs' to your controller imports
import { createJob, getMyJobs, getJobById, getAvailableJobs } from "../controllers/jobController.js";
import { uploadJobImage } from "../controllers/jobImageController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { validateJobRequest } from "../middleware/validate.js"; 
import { upload } from "../config/multer.js";

const router = express.Router();

router.use(authMiddleware);

// 2. ADD THIS: Route definition for technician dashboard feeds
router.get("/available", getAvailableJobs);

router.post("/", validateJobRequest, createJob);
router.get("/my", getMyJobs);
router.get("/:id", getJobById);
router.post("/:id/image", upload.single("image"), uploadJobImage);

export default router;