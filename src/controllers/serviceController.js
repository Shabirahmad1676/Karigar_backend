// src/controllers/serviceController.js
import { jobService } from "../services/jobService.js";

export const getServices = async (req, res, next) => {
  try {
    const services = await jobService.listActiveServices();
    return res.status(200).json(services);
  } catch (err) {
    next(err);
  }
};

export const getServiceById = async (req, res, next) => {
  try {
    const service = await jobService.getServiceById(req.params.id);
    if (!service) return res.status(404).json({ message: "Service not found" });
    return res.status(200).json(service);
  } catch (err) {
    next(err);
  }
};