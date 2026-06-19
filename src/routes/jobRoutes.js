import express from "express";
import { createJob, getMyJobs, getJobById } from "../controllers/jobController.js";
import { uploadJobImage } from "../controllers/jobImageController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { validateJobRequest } from "../middleware/validate.js"; // 1. Import Validator
import { upload } from "../config/multer.js";

const router = express.Router();

router.use(authMiddleware);

// 2. Inject validateJobRequest to sanitize parameters before database execution
router.post("/", validateJobRequest, createJob);

router.get("/my", getMyJobs);
router.get("/:id", getJobById);

// Prompt 5 Endpoint
router.post("/:id/image", upload.single("image"), uploadJobImage);

export default router;