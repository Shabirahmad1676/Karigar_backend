// src/middleware/authorizeRole.js
export const authorizeRole = (role) => {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({
        message: "Forbidden: insufficient permissions",
      });
    }
    next();
  };
};