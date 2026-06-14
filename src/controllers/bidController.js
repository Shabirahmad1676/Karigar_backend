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
