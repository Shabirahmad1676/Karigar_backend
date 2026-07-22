// controllers/chatController.js
import { chatService } from "../services/chatService.js";

export const listTechnicianInbox = async (req, res, next) => {
  try {
    if (req.user.role !== "TECHNICIAN") {
      return res.status(403).json({ message: "Only technicians can access inbox." });
    }

    const rooms = await chatService.getTechnicianInbox(req.user.id);
    return res.status(200).json(rooms);
  } catch (err) {
    next(err);
  }
};

export const getChatRoomByJob = async (req, res, next) => {
  try {
    // 1. Convert string parameter to integer
    const parsedJobId = parseInt(req.params.jobId, 10);

    // 2. Guard Clause: Prevent NaN from reaching Prisma
    if (isNaN(parsedJobId)) {
      return res.status(400).json({ 
        message: "Invalid Job ID provided." 
      });
    }

    // 3. Fetch or create chat room using the validated integer
    const room = await chatService.getOrCreateRoom(parsedJobId);

    if (!room) {
      return res.status(404).json({ message: "Chat room not found." });
    }

    // 4. Auth Check with safe navigation for matches
    const clientId = room.job?.clientId;
    
    // Check if req.user matches the client OR ANY technician matched to this job
    const isClient = req.user.id === clientId;
    const isTechnician = room.job?.matches?.some(
      (match) => match.technicianId === req.user.id
    );
    const isAdmin = req.user.role === "ADMIN";

    if (!isClient && !isTechnician && !isAdmin) {
      return res.status(403).json({ message: "Access denied to this chat session." });
    }

    const messages = await chatService.getRoomMessages(room.id);
    return res.status(200).json({ room, messages });

  } catch (err) {
    next(err);
  }
};