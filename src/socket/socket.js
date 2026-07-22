// socket/socket.js
import { chatService } from "../services/chatService.js";

let io;

export const initializeSocket = (serverIO) => {
  io = serverIO;

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    // Global room assignment
    socket.on("join", ({ userId, role }) => {
      socket.join(`user_${userId}`);
      if (role === "TECHNICIAN") {
        socket.join("technicians");
      }
    });

    // 1. Join Chat Room
    socket.on("join_chat_room", ({ roomId }) => {
      const roomName = `chat_room_${roomId}`;
      socket.join(roomName);
      console.log(`Socket ${socket.id} joined ${roomName}`);
    });

    // 2. Real-time Message Listener
    socket.on("send_message", async ({ roomId, senderId, text }) => {
      try {
        // Persist message to Postgres
        const savedMessage = await chatService.saveMessage({ roomId, senderId, text });

        // Broadcast back to all clients connected in this specific chat room
        io.to(`chat_room_${roomId}`).emit("receive_message", savedMessage);
      } catch (error) {
        console.error("Socket chat error:", error);
        socket.emit("chat_error", { message: "Failed to transmit message." });
      }
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });
};

export const getIO = () => io;