let io;

export const initializeSocket = (serverIO) => {
  io = serverIO;

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    // Join handler accepts userId and role so we can place sockets into role-specific rooms
    socket.on("join", ({ userId, role }) => {
      socket.join(`user_${userId}`);
      if (role === "TECHNICIAN") {
        socket.join("technicians");
      }
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });
};

export const getIO = () => io;