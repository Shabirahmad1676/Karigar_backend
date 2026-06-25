// src/middleware/authMiddleware.js
import jwt from "jsonwebtoken";

export const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Authorization token required" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

export const adminAuthMiddleware = (req, res, next) => {
  if (!req.user || req.user.role !== "ADMIN") {
    return res.status(403).json({ message: "Forbidden: Admin access required" });
  }
  next();
};

// Append this function cleanly right at the bottom of your existing authMiddleware file
export const enforceVerifiedTechnician = (req, res, next) => {
  if (req.user.role === "TECHNICIAN" && req.user.verificationStatus !== "VERIFIED") {
    return res.status(403).json({
      message: "Access Denied: Your technical dispatch profile is currently undergoing document verification review.",
    });
  }
  next();
};