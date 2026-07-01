import prisma from "../lib/prisma.js";
import { getIO } from "../socket/socket.js";

export const createBid = async (req, res) => {
  try {
    if (req.user.role !== "TECHNICIAN") {
      return res.status(403).json({ error: "Only accounts registered as TECHNICIAN can place bids" });
    }

    const jobId = parseInt(req.params.jobId);
    const { amount } = req.body; 
    const technicianId = req.user.id; 

    const existingBid = await prisma.bid.findFirst({
  where: { jobId, technicianId }
});
if (existingBid) {
  return res.status(400).json({ 
    error: "Bidding Restricted: You have already submitted a proposal for this job ticket." 
  });
}

    // 1. Fetch Technician Profile and Active constraints
    const technician = await prisma.technician.findUnique({
      where: { id: technicianId },
      include: { _count: { select: { bids: true } } }
    });

    if (!technician) {
      return res.status(404).json({ error: "Technician profile not found." });
    }

    // ❌ MONETIZATION GATE: Free users are blocked if they have an active assignment
    if (technician.tier === "FREE" && technician.isWorking) {
      return res.status(403).json({ 
        error: "Bidding Restricted: Free tier operators must complete their active assignment before bidding on new leads." 
      });
    }

    // ❌ MONETIZATION GATE: Free users cannot have more than 3 pending bids out on the board
    if (technician.tier === "FREE" && technician._count.bids >= 3) {
      return res.status(403).json({
        error: "Bidding Limit Reached: Free profiles are limited to 3 concurrent active bids. Upgrade to Premium Pass for limitless dispatch bids."
      });
    }

    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    if (job.clientId === technicianId) {
      return res.status(400).json({ error: "You cannot place a bid on your own job posting" });
    }

    const bid = await prisma.bid.create({
      data: { amount, jobId, technicianId },
    });

    const io = getIO();
    if (job.clientId) {
      io.to(`user_${job.clientId}`).emit("new_bid", { jobId, bid });
    }

    return res.status(201).json(bid);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

export const acceptBid = async (req, res) => {
  try {
    const jobId = Number(req.params.jobId);
    const bidId = Number(req.params.bidId);

    if (req.user.role !== "CLIENT") {
      return res.status(403).json({ message: "Only clients can accept bids" });
    }

    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) return res.status(404).json({ message: "Job not found" });

    if (job.clientId !== req.user.id) {
      return res.status(403).json({ message: "Access Denied: Unauthorized job asset modification" });
    }

    const bid = await prisma.bid.findUnique({ where: { id: bidId } });
    if (!bid || bid.jobId !== jobId) {
      return res.status(404).json({ message: "Selected bid does not relate to this job target blueprint." });
    }

    if (job.status !== "PENDING") {
      return res.status(400).json({ message: "Job has already been processed or matched" });
    }

    await prisma.$transaction(async (tx) => {
      // 1. Mark Job as MATCHED
      await tx.job.update({
        where: { id: jobId },
        data: { status: "MATCHED" },
      });

      // 2. Set Technician working status tracker flag to true
      await tx.technician.update({
        where: { id: bid.technicianId },
        data: { isWorking: true }
      });

      // 3. Clear competitive bids
      await tx.bid.deleteMany({
        where: { jobId, id: { not: bidId } },
      });

      // 4. Record JobMatch ledger record entry row
      const calculatedCommission = job.budget * 0.10; 
      await tx.jobMatch.create({
        data: {
          jobId: jobId,
          technicianId: bid.technicianId,
          commissionAmount: calculatedCommission,
          status: "PENDING",
        },
      });
    });

    const io = getIO();
    if (bid.technicianId) {
      io.to(`user_${bid.technicianId}`).emit("bid_accepted", { jobId, bidId, technicianId: bid.technicianId });
    }

    return res.status(200).json({ message: "Bid accepted successfully! Fleet assignment locked." });
  } catch (error) {
    console.error("❌ CRASH INSIDE ACCEPT_BID:", error);
    return res.status(500).json({ message: "Internal server processing failure inside transaction loops." });
  }
};

// 📦 NEW OPERATIONAL WORKFLOW: Track technician's arrival at site
export const technicianArrived = async (req, res, next) => {
  try {
    const jobId = parseInt(req.params.jobId);
    const technicianId = req.user.id;

    const match = await prisma.jobMatch.findFirst({
      where: { jobId, technicianId, job: { status: "MATCHED" } }
    });

    if (!match) return res.status(404).json({ message: "Active assigned engagement not found." });

    await prisma.job.update({
      where: { id: jobId },
      data: { status: "ARRIVED" }
    });

    return res.status(200).json({ message: "Arrival logged. Status updated to ARRIVED." });
  } catch (err) { next(err); }
};

// 📦 NEW OPERATIONAL WORKFLOW: Job Completed Loop Closure
export const technicianCompletedJob = async (req, res, next) => {
  try {
    const jobId = parseInt(req.params.jobId);
    const technicianId = req.user.id;

    const match = await prisma.jobMatch.findFirst({
      where: { jobId, technicianId, job: { status: "ARRIVED" } }
    });

    if (!match) return res.status(404).json({ message: "Active on-site job matching criteria not found." });

    await prisma.$transaction(async (tx) => {
      // 1. Transition job to COMPLETED state
      await tx.job.update({
        where: { id: jobId },
        data: { status: "COMPLETED" }
      });

      // 2. Clear out technician's working constraint block lock
      await tx.technician.update({
        where: { id: technicianId },
        data: { isWorking: false }
      });

      // 3. Mark the ledger transaction row status as COMPLETED
      await tx.jobMatch.update({
        where: { id: match.id },
        data: { status: "COMPLETED" }
      });

      // 4. Clean up the winning bid entry row from the platform memory
      await tx.bid.deleteMany({ where: { jobId } });
    });

    return res.status(200).json({ message: "Job marked complete. Dispatch technician is free for next bookings." });
  } catch (err) { next(err); }
};

// 📦 NEW OPERATIONAL WORKFLOW: Leave a review for technician
export const createJobReview = async (req, res, next) => {
  try {
    const jobId = parseInt(req.params.jobId);
    const { rating, comment } = req.body;
    const clientId = req.user.id;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Rating boundary constraints must scale between 1 and 5 stars." });
    }

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: { matches: true }
    });

    if (!job || job.clientId !== clientId || job.status !== "COMPLETED") {
      return res.status(400).json({ error: "Reviews can only be recorded against completed jobs by their original poster." });
    }

    const activeMatch = job.matches[0];
    if (!activeMatch) return res.status(404).json({ error: "Relational match log missing." });

    const review = await prisma.review.create({
      data: {
        rating: parseInt(rating),
        comment,
        jobId,
        clientId,
        technicianId: activeMatch.technicianId
      }
    });

    return res.status(201).json({ message: "Review stored successfully.", review });
  } catch (err) { next(err); }
};