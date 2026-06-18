export const errorHandler = (err, req, res, next) => {
  console.error(err);

  // Prisma unique constraint
  if (err.code === "P2002") {
    return res.status(409).json({
      success: false,
      error: "Duplicate value",
    });
  }

  res.status(err.statusCode || 500).json({
    success: false,
    error: err.message || "Internal Server Error",
  });
};