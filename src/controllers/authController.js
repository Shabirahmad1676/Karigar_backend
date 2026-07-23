// src/controllers/authController.js
import prisma from "../lib/prisma.js";
import bcrypt from "bcrypt";
import { generateToken } from "../utils/generateToken.js";
import redisClient from "../config/redis.js";

/**
 * Fetch technicians near the client using raw Haversine spatial SQL computation.
 * Falls back to city-based caching if coordinates are missing.
 * @route GET /api/technicians/nearby
 */
export const getNearbyTechnicians = async (req, res, next) => {
  try {
    const { lat, lng, radiusKm } = req.query;
    const cityParam = req.query.city || "Mardan";
    const cleanCity = cityParam.trim().toLowerCase();
    const radius = parseFloat(radiusKm) || 15;

    // Convert query text parameters to floating point coordinate metrics safely
    const clientLat = parseFloat(lat);
    const clientLng = parseFloat(lng);

    // If coordinates are valid numbers, execute accurate distance calculation mapping
    if (!isNaN(clientLat) && !isNaN(clientLng)) {
      const technicians = await prisma.$queryRaw`
        SELECT 
          id, name, "skillCategory", city, "selfieImageUrl", "isWorking", latitude, longitude,
          (6371 * acos(
            cos(radians(${clientLat})) * cos(radians(latitude)) * 
            cos(radians(longitude) - radians(${clientLng})) + 
            sin(radians(${clientLat})) * sin(radians(latitude))
          )) AS distance
        FROM "Technician"
        WHERE "verificationStatus" = 'VERIFIED' 
          AND "isVerified" = true
          AND latitude IS NOT NULL 
          AND longitude IS NOT NULL
          AND (6371 * acos(
            cos(radians(${clientLat})) * cos(radians(latitude)) * 
            cos(radians(longitude) - radians(${clientLng})) + 
            sin(radians(${clientLat})) * sin(radians(latitude))
          )) <= ${radius}
        ORDER BY distance ASC
        LIMIT 10;
      `;
      
      return res.status(200).json(technicians);
    }
    
    // Fallback: Create a dynamic cache key based on the city name
    const CACHE_KEY = `nearby_technicians:${cleanCity}`;
    const CACHE_EXPIRATION = 300; // 5 minutes

    // Check Redis cache first
    if (redisClient.isReady) {
      const cachedData = await redisClient.get(CACHE_KEY);
      if (cachedData) {
        return res.status(200).json(JSON.parse(cachedData));
      }
    }

    // Cache miss: Fetch from Postgres filtered by this specific city
    const verifiedFleet = await prisma.technician.findMany({
      where: {
        verificationStatus: "VERIFIED",
        isVerified: true,
        city: { equals: cityParam, mode: 'insensitive' }
      },
      take: 6,
      select: {
        id: true,
        name: true,
        skillCategory: true,
        city: true,
        selfieImageUrl: true,
        isWorking: true
      }
    });

    // Save the results back into Redis using the city-specific key
    if (redisClient.isReady && verifiedFleet.length > 0) {
      await redisClient.setEx(CACHE_KEY, CACHE_EXPIRATION, JSON.stringify(verifiedFleet));
    }

    return res.status(200).json(verifiedFleet);
  } catch (err) { 
    next(err); 
  }
};


export const getTechnicianProfileById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const technicianId = parseInt(id);

    if (isNaN(technicianId)) {
      return res.status(400).json({ message: "Invalid profile identifier lookup configuration." });
    }

    const profile = await prisma.technician.findUnique({
      where: { id: technicianId, isVerified: true },
      select: {
        id: true,
        name: true,
        skillCategory: true,
        city: true,
        selfieImageUrl: true,
        tier: true,
        isWorking: true,
        reviewsReceived: {
          select: {
            id: true,
            rating: true,
            comment: true,
            createdAt: true,
            client: {
              select: { name: true }
            }
          },
          orderBy: { createdAt: "desc" }
        }
      }
    });

    if (!profile) {
      return res.status(404).json({ message: "Technical dispatch profile could not be located." });
    }

    return res.status(200).json(profile);
  } catch (err) {
    next(err);
  }
};


/**
 * Register a new client profile or technician dispatch account profile entries.
 * @route POST /api/auth/register
 */
export const register = async (req, res) => {
  try {
    const { name, email, phone, password, role, skillCategory, city, latitude, longitude } = req.body;
    
    if (!name || !email || !phone || !password || !role) {
      return res.status(400).json({ message: "All core fields are required" });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          name,
          email,
          phone,
          password: hashedPassword,
          role: role === "TECHNICIAN" ? "TECHNICIAN" : "CLIENT",
        },
      });

      if (role === "TECHNICIAN") {
        await tx.technician.create({
          data: {
            id: newUser.id,
            name,
            phone,
            skillCategory: skillCategory || "General Maintenance",
            city: city || "Mardan",
            latitude: latitude ? parseFloat(latitude) : null,
            longitude: longitude ? parseFloat(longitude) : null,
          }
        });
      }
      return newUser;
    });

    const token = generateToken(user);
    return res.status(201).json({
      message: "Profile created successfully",
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

/**
 * Authenticate login data strings across multiple identification variables.
 * @route POST /api/auth/login
 */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: email },
          { phone: email },
          { 
            role: "TECHNICIAN",
            id: {
              in: await prisma.technician.findMany({
                where: { whatsappGroupName: email },
                select: { id: true }
              }).then(techs => techs.map(t => t.id))
            }
          }
        ]
      }
    });

    if (!user) return res.status(400).json({ message: "Invalid system credentials." });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid system credentials." });

    let verificationStatus = "UNVERIFIED";
    let technicianIdKey = "";
    let technicianPhone = "";
    
    if (user.role === "TECHNICIAN") {
      const profile = await prisma.technician.findUnique({ where: { id: user.id } });
      if (profile) {
        verificationStatus = profile.verificationStatus;
        technicianIdKey = profile.whatsappGroupName; 
        technicianPhone = profile.phone;             
      }
    }

    const token = generateToken(user);

    return res.status(200).json({
      message: "Access Authorized",
      token,
      user: { 
        id: user.id, 
        name: user.name, 
        email: user.email,
        role: user.role, 
        verificationStatus,
        phone: technicianPhone,
        customId: technicianIdKey 
      }
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};


// POST /api/auth/push-token
export const updatePushToken = async (req, res, next) => {
  try {
    const { pushToken, platform } = req.body; 
    const userId = req.user.id; 

    if (!pushToken) {
      return res.status(400).json({ message: "pushToken is required." });
    }

    // 1. Store/Upsert multi-device token mapping
    await prisma.deviceToken.upsert({
      where: { token: pushToken },
      update: { 
        userId, 
        platform: platform || null 
      },
      create: {
        userId,
        token: pushToken,
        platform: platform || null,
      },
    });

    // 2. Keep user.pushToken updated as a convenient primary fallback
    await prisma.user.update({
      where: { id: userId },
      data: { pushToken },
    });

    return res.status(200).json({ 
      success: true, 
      message: "Device push token registered successfully." 
    });
  } catch (error) {
    next(error);
  }
};