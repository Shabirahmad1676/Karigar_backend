import prisma from "../lib/prisma.js";

export const uploadJobImage = async (req, res, next) => {
  try {
    const jobId = parseInt(req.params.id);

    if (!req.file) {
      return res.status(400).json({ message: "Please upload an image file" });
    }

    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    // Authenticated Client Owner check
    if (job.clientId !== req.user.id) {
      return res.status(403).json({ message: "Forbidden: You are not the owner of this job" });
    }

    const imageUrl = `/uploads/${req.file.filename}`;

    const updatedJob = await prisma.job.update({
      where: { id: jobId },
      data: { imageUrl }
    });

    return res.status(200).json({
      message: "Job photograph attached successfully",
      job: updatedJob
    });
  } catch (err) {
    next(err);
  }
};