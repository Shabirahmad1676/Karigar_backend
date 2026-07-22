import { jobService } from "../services/jobService.js";
import redisClient from "../config/redis.js";

export const getServices = async (req, res, next) => {
  const cacheKey = "services:active";
  const CACHE_TTL = 3600;

  try {
    // 🌟 TEMPORARY DEBUG LINE: Force clear Redis every request
    await redisClient.del(cacheKey); 
    console.log("🔥 Debug: Force deleted Redis cache key!");

    // 1. Try to fetch from Redis (will miss now)
    const cachedServices = await redisClient.get(cacheKey);
    if (cachedServices) {
      console.log("Serving services from Redis cache");
      return res.status(200).json(JSON.parse(cachedServices));
    }

    // 2. Fetch directly from DB
    const services = await jobService.listActiveServices();
    // 🌟 DEBUG LOG: See exactly what the database is returning
    console.log("📡 DB Response Type:", typeof services, "Length:", services?.length, "Data:", services);

    if (services && services.length > 0) {
      await redisClient.set(cacheKey, JSON.stringify(services), { EX: CACHE_TTL });
    }

    return res.status(200).json(services);
  } catch (err) {
    next(err);
  }
};


export const getServiceById = async (req, res, next) => {
  try {
    const category = await jobService.getCategoryById(req.params.id);
    if (!category) return res.status(404).json({ message: "Category not found" });
    return res.status(200).json(category);
  } catch (err) {
    next(err);
  }
};