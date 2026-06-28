import prisma from "../lib/prisma.js";
import { getIO } from "../socket/socket.js";

export const createBid = async (req, res) => {
  try {
    // 1. Role Authorization Check
    if (req.user.role !== "TECHNICIAN") {
      return res.status(403).json({
        error: "Only accounts registered as TECHNICIAN can place bids",
      });
    }

    const jobId = parseInt(req.params.jobId);
    const { amount } = req.body; 
    const technicianId = req.user.id; 

    // 2. Verify target job exists
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    // 3. Safety Check: Prevent bidding on your own job posting
    if (job.clientId === technicianId) {
      return res.status(400).json({ error: "You cannot place a bid on your own job posting" });
    }

    // 4. Save the Bid securely to the database
    const bid = await prisma.bid.create({
      data: { 
        amount, 
        jobId, 
        technicianId 
      },
    });

    // Notify the job owner (client) about the new bid
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

    // Find the target job
    const job = await prisma.job.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    // Ensure authenticated owner check passes
    if (job.clientId !== req.user.id) {
      return res.status(403).json({ message: "You are not allowed to accept bids for this job" });
    }

    // Find the selected bid along with its tech profile parameters
    const bid = await prisma.bid.findUnique({
      where: { id: bidId },
    });

    if (!bid || bid.jobId !== jobId) {
      return res.status(404).json({ message: "Bid does not belong to this job target footprint" });
    }

    if (job.status !== "PENDING") {
      return res.status(400).json({ message: "Job has already been processed or matched" });
    }

    // Enforce multi-table ACID relation safety bounds
    await prisma.$transaction(async (tx) => {
      
      // 1. Update overall job state to MATCHED
      await tx.job.update({
        where: { id: jobId },
        data: { status: "MATCHED" },
      });

      // 2. Clear out all other competitive unselected bids for this specific assignment
      await tx.bid.deleteMany({
        where: {
          jobId,
          id: { not: bidId },
        },
      });

      // 3. Automatically spawn a structural JobMatch ledger row mapping the chosen operator
      // Dynamically calculate a 10% marketplace commission or fallback to a flat rate (e.g., Rs. 150)
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

    // Notify the successful technical dispatch operator over Socket channels
    const io = getIO();
    if (bid.technicianId) {
      io.to(`user_${bid.technicianId}`).emit("bid_accepted", {
        jobId,
        bidId,
        technicianId: bid.technicianId,
      });
    }

    return res.status(200).json({
      message: "Bid accepted successfully! Fleet assignment is securely written to the ledger.",
    });

  } catch (error) {
    console.error("❌ CRASH INSIDE ACCEPT_BID:", error);
    return res.status(500).json({
      message: "Internal server processing failure inside transaction loops.",
    });
  }
};