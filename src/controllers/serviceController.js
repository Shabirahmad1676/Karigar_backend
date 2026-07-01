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
    const category = await jobService.getCategoryById(req.params.id);
    if (!category) return res.status(404).json({ message: "Category not found" });
    return res.status(200).json(category);
  } catch (err) {
    next(err);
  }
};