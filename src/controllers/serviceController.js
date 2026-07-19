import { jobService } from "../services/jobService.js";
import redisClient from "../config/redis.js";

export const getServices = async (req, res, next) => {
  const cacheKey = "services:active";
  const CACHE_TTL = 3600; // Cache duration in seconds (1 hour)

  try {
    // 1. Try to fetch the list from Redis cache
    const cachedServices = await redisClient.get(cacheKey);

    if (cachedServices) {
      console.log("Serving services from Redis cache");
      return res.status(200).json(JSON.deserialize ? JSON.deserialize(cachedServices) : JSON.parse(cachedServices));
    }

    // 2. Cache miss: Fetch directly from the database
    const services = await jobService.listActiveServices();

    // 3. Store the freshly queried result inside Redis with an expiration window
    await redisClient.set(cacheKey, JSON.stringify(services), {
      EX: CACHE_TTL,
    });

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