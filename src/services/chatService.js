// services/chatService.js
import prisma from "../lib/prisma.js";

export const chatService = {
  // Get or lazily create room for a job
  async getOrCreateRoom(jobId) {
    let room = await prisma.chatRoom.findUnique({
      where: { jobId: parseInt(jobId) },
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
        data: { jobId: parseInt(jobId) },
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

  // Save incoming message
  async saveMessage({ roomId, senderId, text }) {
    return prisma.message.create({
      data: {
        roomId: parseInt(roomId),
        senderId: parseInt(senderId),
        text
      }
    });
  },

  // Fetch paginated message history
  async getRoomMessages(roomId) {
    return prisma.message.findMany({
      where: { roomId: parseInt(roomId) },
      orderBy: { createdAt: "asc" },
      take: 50
    });
  },

  async getTechnicianInbox(technicianId) {
    const rooms = await prisma.chatRoom.findMany({
      where: {
        job: {
          matches: {
            some: { technicianId: parseInt(technicianId) }
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
      technicianIds: [parseInt(technicianId)],
      lastMessage: room.messages[0] || null,
      updatedAt: room.updatedAt,
    }));
  }
};