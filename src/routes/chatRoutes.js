// routes/chatRoutes.js
import express from "express";
import { listTechnicianInbox, getChatRoomByJob } from "../controllers/chatController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(authMiddleware);
router.get("/my", listTechnicianInbox);
router.get("/job/:jobId", getChatRoomByJob);

export default router;