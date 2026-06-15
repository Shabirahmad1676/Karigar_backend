import prisma from "../lib/prisma.js";


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
  return res.status(403).json({
    message: "Only clients can accept bids",
  });
}

    // Find job
    const job = await prisma.job.findUnique({
      where: {
        id: jobId,
      },
    });

    if (!job) {
      return res.status(404).json({
        message: "Job not found",
      });
    }

    // Ensure owner
    if (job.clientId !== req.user.id) {
      return res.status(403).json({
        message: "You are not allowed to accept bids for this job",
      });
    }

    // Find bid
    const bid = await prisma.bid.findUnique({
      where: {
        id: bidId,
      },
    });

    if (!bid) {
      return res.status(404).json({
        message: "Bid not found",
      });
    }

    // Ensure bid belongs to this job
    if (bid.jobId !== jobId) {
      return res.status(400).json({
        message: "Bid does not belong to this job",
      });
    }

       if (job.status !== "PENDING") {
  return res.status(400).json({
    message: "Job has already been processed",
  });
}

    // Transaction
    await prisma.$transaction(async (tx) => {

      // Accept selected bid
      await tx.bid.update({
        where: {
          id: bidId,
        },
        data: {
          status: "ACCEPTED",
        },
      });

      // Reject all other bids
      await tx.bid.updateMany({
        where: {
          jobId,
          id: {
            not: bidId,
          },
        },
        data: {
          status: "REJECTED",
        },
      });

      // Update job status
      await tx.job.update({
        where: {
          id: jobId,
        },
        data: {
          status: "ACCEPTED",
        },
      });
    });

 

    return res.status(200).json({
      message: "Bid accepted successfully",
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};