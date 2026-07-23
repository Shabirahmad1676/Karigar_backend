import prisma from "../lib/prisma.js";
import { getIO } from "../socket/socket.js";
import { sendPushNotification } from "../services/notificationService.js";

const triggerNotification = async (userId, title, message, data = {}) => {
  try {
    // 1. Store in Database
    const notification = await prisma.notification.create({
      data: { userId, title, message }
    });

    // 2. Broadcast live WebSocket event (Foreground active users)
    const io = getIO();
    io.to(`user_${userId}`).emit("new_notification", notification);

    // 3. Dispatch Native Expo Push Notification (Background / Terminated state users)
    sendPushNotification({
      targetUserId: userId,
      title,
      body: message,
      data,
    }).catch((err) => console.error("[Bid Notification Push Error]:", err));

    return notification;
  } catch (error) {
    console.error("[Trigger Notification Error]:", error);
  }
};

export const createBid = async (req, res) => {
  try {
    const jobId = parseInt(req.params.jobId, 10);
    const { amount } = req.body;
    const technicianId = req.user.id;

    if (isNaN(jobId)) {
      return res.status(400).json({ error: "Invalid Job ID provided." });
    }

    const existingBid = await prisma.bid.findUnique({
      where: {
        jobId_technicianId: { jobId, technicianId }
      }
    });

    if (existingBid) {
      return res.status(400).json({ 
        success: false, 
        error: "Duplicate Proposal Blocked: You have already submitted an active quote rate for this job item." 
      });
    }

    // 1. Fetch job and check if it exists before using job.clientId
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) {
      return res.status(404).json({ error: "Job ticket reference not found." });
    }

    // 2. Create the bid
    const bid = await prisma.bid.create({
      data: { amount, jobId, technicianId },
    });

    // 3. Notify client safely
    await triggerNotification(
      job.clientId,
      "New Bid Received! 💰",
      `A specialist technician has quoted Rs. ${amount.toLocaleString()} for your assignment request.`
    );

    return res.status(201).json(bid);
  } catch (err) { 
    return res.status(500).json({ error: err.message }); 
  }
};

export const acceptBid = async (req, res) => {
  try {
    const jobId = Number(req.params.jobId);
    const bidId = Number(req.params.bidId);

    if (isNaN(jobId) || isNaN(bidId)) {
      return res.status(400).json({ message: "Invalid jobId or bidId provided." });
    }

    const bid = await prisma.bid.findUnique({ 
      where: { id: bidId }, 
      include: { technician: true } 
    });

    if (!bid) {
      return res.status(404).json({ message: "The selected bid proposal could not be found." });
    }

    await prisma.$transaction(async (tx) => {
      // 1. Update job status and lock budget
      await tx.job.update({
        where: { id: jobId },
        data: { 
          status: "MATCHED",
          budget: bid.amount 
        }
      });

      // 2. Mark technician as working
      await tx.technician.update({
        where: { id: bid.technicianId },
        data: { isWorking: true }
      });

      // 3. Create JobMatch row
      const platformCommission = bid.amount * 0.10;
      await tx.jobMatch.create({
        data: {
          jobId: jobId,
          technicianId: bid.technicianId,
          commissionAmount: platformCommission,
          status: "PENDING"
        }
      });

      // 4. Safely create ChatRoom if it doesn't exist
      await tx.chatRoom.upsert({
        where: { jobId: jobId },
        create: { jobId: jobId },
        update: {}
      });
    });

    // Notify technician & dispatch websocket alerts
    await triggerNotification(
      bid.technicianId,
      "Bid Accepted! Pack your tools!",
      `Your quote for Job ticket reference ID #${jobId} has been accepted.`
    );
    
    const io = getIO();
    io.to("technicians").emit("bid_accepted", { jobId });
    io.emit("job_status_changed", { jobId, status: "MATCHED" });

    return res.status(200).json({ message: "Assignment finalized and chat room activated." });
  } catch (error) { 
    console.error("🔴 acceptBid Error:", error);
    return res.status(500).json({ message: error.message || "Error processing acceptance." }); 
  }
};

export const technicianArrived = async (req, res, next) => {
  try {
    const jobId = parseInt(req.params.jobId, 10);
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

export const technicianCompletedJob = async (req, res, next) => {
  try {
    const jobId = parseInt(req.params.jobId, 10);
    const technicianId = req.user.id;

    const match = await prisma.jobMatch.findFirst({
      where: { jobId, technicianId, job: { status: "ARRIVED" } }
    });

    if (!match) return res.status(404).json({ message: "Active on-site job matching criteria not found." });

    await prisma.$transaction(async (tx) => {
      await tx.job.update({
        where: { id: jobId },
        data: { status: "COMPLETED" }
      });

      await tx.technician.update({
        where: { id: technicianId },
        data: { isWorking: false }
      });

      await tx.jobMatch.update({
        where: { id: match.id },
        data: { status: "COMPLETED" }
      });

      await tx.bid.deleteMany({ where: { jobId } });
    });

    const io = getIO();
    io.emit("job_status_changed", { jobId, status: "COMPLETED" });

    return res.status(200).json({ message: "Job marked complete. Dispatch technician is free for next bookings." });
  } catch (err) { next(err); }
};

export const createJobReview = async (req, res, next) => {
  try {
    const jobId = parseInt(req.params.jobId, 10);
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
        rating: parseInt(rating, 10),
        comment,
        jobId,
        clientId,
        technicianId: activeMatch.technicianId
      }
    });

    return res.status(201).json({ message: "Review stored successfully.", review });
  } catch (err) { next(err); }
};