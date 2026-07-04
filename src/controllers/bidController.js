import prisma from "../lib/prisma.js";
import { getIO } from "../socket/socket.js";

const triggerNotification = async (userId, title, message) => {
  // 1. Persist notification safely inside DB storage ledger lines
  const notification = await prisma.notification.create({
    data: { userId, title, message }
  });

  // 2. Dispatch real-time websocket transport notification payload out instantly
  const io = getIO();
  io.to(`user_${userId}`).emit("new_notification", notification);
};

export const createBid = async (req, res) => {
  try {
    // Standard validation checking context...
    const jobId = parseInt(req.params.jobId);
    const { amount } = req.body;
    const technicianId = req.user.id;

    // Fetch details matching job allocation blueprint references
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    
    const bid = await prisma.bid.create({
      data: { amount, jobId, technicianId },
    });

    // Alert Client instantly that a new technician quote proposal has arrived
    await triggerNotification(
      job.clientId,
      "New Bid Received! 💰",
      `A specialist technician has quoted Rs. ${amount.toLocaleString()} for your assignment request.`
    );

    return res.status(201).json(bid);
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

export const acceptBid = async (req, res) => {
  try {
    const jobId = Number(req.params.jobId);
    const bidId = Number(req.params.bidId);
    const bid = await prisma.bid.findUnique({ where: { id: bidId } });

    await prisma.$transaction(async (tx) => {
      // Execute your core MATCHED status database modification lines here...
    });

    // Notify the technician immediately that their bid proposal has won the dispatch match contract!
    await triggerNotification(
      bid.technicianId,
      "Bid Accepted! 🛠️",
      `Pack your tools! Your quote for Job ticket reference ID #${jobId} has been accepted by the client.`
    );

    return res.status(200).json({ message: "Assignment finalized." });
  } catch (error) { return res.status(500).json({ message: "Error processing." }); }
};


//  NEW OPERATIONAL WORKFLOW: Track technician's arrival at site
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

//  NEW OPERATIONAL WORKFLOW: Job Completed Loop Closure
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

//  NEW OPERATIONAL WORKFLOW: Leave a review for technician
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