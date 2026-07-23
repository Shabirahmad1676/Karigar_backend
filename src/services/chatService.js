// services/chatService.js
import prisma from "../lib/prisma.js";
import { sendPushNotification } from "./notificationService.js";

export const chatService = {
  // Get or lazily create room for a job
  async getOrCreateRoom(jobId) {
    const parsedJobId = parseInt(jobId, 10);
    if (isNaN(parsedJobId)) {
      throw new Error("Invalid Job ID provided.");
    }

    let room = await prisma.chatRoom.findUnique({
      where: { jobId: parsedJobId },
      include: {
        job: {
          select: {
            id: true,
            title: true,
            clientId: true,
            matches: { select: { technicianId: true } }
          }
        }
      }
    });

    if (!room) {
      room = await prisma.chatRoom.create({
        data: { jobId: parsedJobId },
        include: {
          job: {
            select: {
              id: true,
              title: true,
              clientId: true,
              matches: { select: { technicianId: true } }
            }
          }
        }
      });
    }

    return room;
  },

  // Save incoming message & trigger Push Notification
  async saveMessage({ roomId, senderId, text }) {
    const parsedRoomId = parseInt(roomId, 10);
    const parsedSenderId = parseInt(senderId, 10);

    // 1. Persist message to database
    const message = await prisma.message.create({
      data: {
        roomId: parsedRoomId,
        senderId: parsedSenderId,
        text
      }
    });

    // 2. Fetch room & job details to identify the recipient
    const room = await prisma.chatRoom.findUnique({
      where: { id: parsedRoomId },
      include: {
        job: {
          select: {
            id: true,
            title: true,
            clientId: true,
            matches: { select: { technicianId: true } }
          }
        }
      }
    });

    if (room && room.job) {
      const clientId = room.job.clientId;
      // Gather all technician IDs matched to this job safely
      const matchedTechnicianIds = room.job.matches.map((m) => m.technicianId);

      // Determine recipient: if client sent it, notify all matched technicians; if technician sent it, notify client
      let recipientIds = [];
      if (parsedSenderId === clientId) {
        recipientIds = matchedTechnicianIds;
      } else if (matchedTechnicianIds.includes(parsedSenderId)) {
        recipientIds = [clientId];
      }

      // 3. Dispatch Push Notifications asynchronously
      for (const targetUserId of recipientIds) {
        sendPushNotification({
          targetUserId,
          title: `New message on ${room.job.title || `Job #${room.jobId}`}`,
          body: text,
          data: { jobId: room.jobId, screen: `chat/${room.jobId}` }
        }).catch((err) => console.error("[Push Service Error]:", err));
      }
    }

    return message;
  },

  // Fetch paginated message history
  async getRoomMessages(roomId) {
    const parsedRoomId = parseInt(roomId, 10);
    return prisma.message.findMany({
      where: { roomId: parsedRoomId },
      orderBy: { createdAt: "asc" },
      take: 50
    });
  },

  // Fetch technician chat inbox list
  async getTechnicianInbox(technicianId) {
    const parsedTechId = parseInt(technicianId, 10);
    const rooms = await prisma.chatRoom.findMany({
      where: {
        job: {
          matches: {
            some: { technicianId: parsedTechId }
          }
        }
      },
      include: {
        job: {
          select: {
            id: true,
            title: true,
            clientId: true
          }
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1
        }
      },
      orderBy: { updatedAt: "desc" }
    });

    return rooms.map((room) => ({
      id: room.id,
      jobId: room.jobId,
      jobTitle: room.job?.title || `Job #${room.jobId}`,
      clientId: room.job?.clientId,
      technicianIds: [parsedTechId],
      lastMessage: room.messages[0] || null,
      updatedAt: room.updatedAt
    }));
  }
};