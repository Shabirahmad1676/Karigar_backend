import express from "express";
import prisma from "../lib/prisma.js";
import { authMiddleware, adminAuthMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

// Enforce modern stateless JSON web token verification instead of old browser session blocks
router.use(authMiddleware);
router.use(adminAuthMiddleware);

// GET /admin/dashboard - Returns pure JSON analytics metrics
router.get("/dashboard", async (req, res, next) => {
  try {
    const jobCounts = await prisma.job.groupBy({
      by: ["status"],
      _count: { status: true }
    });
    
    const stats = { PENDING: 0, POSTED: 0, MATCHED: 0, COMPLETED: 0, CANCELLED: 0 };
    jobCounts.forEach(item => {
      if (stats[item.status] !== undefined) {
        stats[item.status] = item._count.status;
      }
    });
    
    return res.status(200).json({ stats });
  } catch (err) {
    next(err);
  }
});

export default router;