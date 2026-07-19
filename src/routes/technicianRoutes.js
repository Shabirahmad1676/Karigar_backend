import express from "express";
import { authMiddleware, enforceVerifiedTechnician } from "../middleware/authMiddleware.js";
import { createBid, technicianArrived, technicianCompletedJob } from "../controllers/bidController.js";
import { getNearbyTechnicians, getTechnicianProfileById } from "../controllers/authController.js";
import { upload } from "../config/multer.js";
import prisma from "../lib/prisma.js";

const router = express.Router();

router.get("/nearby", getNearbyTechnicians);
router.get("/profile/:id", getTechnicianProfileById); 
router.use(authMiddleware);

// 📦 NEW OPERATIONAL PATHWAYS: Arrival & Completion Lifecycle States
router.post("/jobs/:jobId/arrive", enforceVerifiedTechnician, technicianArrived);
router.post("/jobs/:jobId/complete", enforceVerifiedTechnician, technicianCompletedJob);

router.post("/verify-docs", upload.fields([
  { name: "cnicFront", maxCount: 1 },
  { name: "selfieProof", maxCount: 1 }
]), async (req, res, next) => {
  try {
    const { cnicNumber } = req.body;
    const technicianId = req.user.id;

    if (!req.files || !req.files.cnicFront || !req.files.selfieProof) {
      return res.status(400).json({ message: "Both CNIC Front and Selfie images are required" });
    }

    const cnicImageUrl = `/uploads/${req.files.cnicFront[0].filename}`;
    const selfieImageUrl = `/uploads/${req.files.selfieProof[0].filename}`;

    await prisma.technician.update({
      where: { id: technicianId },
      data: { cnicNumber, cnicImageUrl, selfieImageUrl }
    });

    return res.status(200).json({ message: "Verification proof documents uploaded to queue smoothly." });
  } catch (err) { next(err); }
});

router.post("/bids/:jobId", enforceVerifiedTechnician, createBid);

export default router;