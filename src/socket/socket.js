let io;

export const initializeSocket = (socketServer) => {
  io = socketServer;
};

export const getIO = () => {
  if (!io) {
    throw new Error("Socket.io not initialized");
  }

  return io;
};