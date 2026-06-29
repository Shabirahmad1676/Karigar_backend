import { jobService } from "../services/jobService.js";
import { createJobReview } from "./bidController.js";

export const createJob = async (req, res, next) => {
  try {
    if (req.user.role !== "CLIENT") {
      return res.status(403).json({ message: "Only clients can post jobs" });
    }
    const job = await jobService.createJob(req.user.id, req.body);
    return res.status(201).json(job);
  } catch (err) { next(err); }
};

export const getMyJobs = async (req, res, next) => {
  try {
    const jobs = await jobService.getClientJobs(req.user.id);
    return res.status(200).json(jobs);
  } catch (err) { next(err); }
};

export const getJobById = async (req, res, next) => {
  try {
    const job = await jobService.getJobById(req.params.id);
    if (!job) return res.status(404).json({ message: "Job not found" });

    if (job.clientId !== req.user.id && req.user.role !== "ADMIN") {
      return res.status(403).json({ message: "Access denied to this job profile" });
    }

    return res.status(200).json(job);
  } catch (err) { next(err); }
};

export const getAvailableJobs = async (req, res, next) => {
  try {
    if (req.user.role !== "TECHNICIAN") {
      return res.status(403).json({ message: "Forbidden: Only technician accounts can browse open requests" });
    }
    const jobs = await jobService.getAvailableJobs();
    return res.status(200).json(jobs);
  } catch (err) { next(err); }
};

export const postJobReview = createJobReview;