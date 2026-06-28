import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { enforceVerifiedTechnician } from "../middleware/authMiddleware.js";
import { createBid } from "../controllers/bidController.js";
import { upload } from "../config/multer.js"; // ✅ Import your existing multer utility
import prisma from "../lib/prisma.js";
import { getNearbyTechnicians } from "../controllers/authController.js";

const router = express.Router();

router.get("/nearby", getNearbyTechnicians);
router.use(authMiddleware);

// ✅ ADD THIS ROUTE: Handles both image data structures simultaneously
router.post(
  "/verify-docs",
  (req, res, next) => {
    console.log("🔍 [STAGE 1] Request passed auth, entering Multer parser...");
    next();
  },
  upload.fields([
    { name: "cnicFront", maxCount: 1 },
    { name: "selfieProof", maxCount: 1 }
  ]),
  async (req, res, next) => {
    try {
      console.log("🔍 [STAGE 2] Multer processing complete. Files received:", req.files);
      console.log("🔍 [STAGE 2] Form body text received:", req.body);

      const { cnicNumber } = req.body;
      const technicianId = req.user.id;

      if (!req.files || !req.files.cnicFront || !req.files.selfieProof) {
        console.log("❌ [STAGE 3] Validation failed: Missing files");
        return res.status(400).json({ message: "Both CNIC Front and Selfie images are required" });
      }

      const cnicImageUrl = `/uploads/${req.files.cnicFront[0].filename}`;
      const selfieImageUrl = `/uploads/${req.files.selfieProof[0].filename}`;

      console.log(`🔍 [STAGE 4] Attempting Prisma update for Technician ID: ${technicianId}`);

      const updated = await prisma.technician.update({
        where: { id: technicianId },
        data: {
          cnicNumber,
          cnicImageUrl,
          selfieImageUrl,
        }
      });

      console.log("✅ [STAGE 5] Prisma database write successful!");
      return res.status(200).json({ message: "Verification proof documents uploaded to queue smoothly." });
    } catch (err) {
      console.error("❌ [CRASH] Error inside /verify-docs handler:", err);
      next(err);
    }
  }
);

router.post("/bids/:jobId", enforceVerifiedTechnician, createBid);

export default router;