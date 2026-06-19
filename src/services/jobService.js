import prisma from "../lib/prisma.js";

export const jobService = {
  async listActiveServices() {
    return prisma.service.findMany({ where: { isActive: true } });
  },

  async getServiceById(id) {
    return prisma.service.findUnique({ where: { id: parseInt(id) } });
  },

  async createJob(clientId, jobData) {
    return prisma.job.create({
      data: {
        clientId,
        serviceId: parseInt(jobData.serviceId),
        title: jobData.title,
        description: jobData.description,
        budget: parseInt(jobData.budget),
        latitude: jobData.latitude ? parseFloat(jobData.latitude) : null,
        longitude: jobData.longitude ? parseFloat(jobData.longitude) : null,
        address: jobData.address,
        imageUrl: jobData.imageUrl,
        status: "PENDING",
      },
    });
  },

  async getClientJobs(clientId) {
    return prisma.job.findMany({
      where: { clientId },
      include: { service: true },
      orderBy: { createdAt: "desc" },
    });
  },

  async getJobById(id) {
    return prisma.job.findUnique({
      where: { id: parseInt(id) },
      include: { service: true, client: { select: { id: true, name: true, email: true } } },
    });
  },
};