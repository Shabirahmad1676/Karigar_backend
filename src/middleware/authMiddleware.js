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

import prisma from "../lib/prisma.js"; // 👈 Ensure Prisma is imported at the top of the file

export const enforceVerifiedTechnician = async (req, res, next) => {
  try {
    if (req.user.role === "TECHNICIAN") {
      // Look up the actual live profile state inside the system ledger
      const profile = await prisma.technician.findUnique({
        where: { id: req.user.id }
      });

      if (!profile || profile.verificationStatus !== "VERIFIED") {
        return res.status(403).json({
          message: "Access Denied: Your technical dispatch profile is currently undergoing document verification review.",
        });
      }
    }
    next();
  } catch (err) {
    next(err);
  }
};