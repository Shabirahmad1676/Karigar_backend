import prisma from "../lib/prisma.js";

export const jobService = {
  // Returns main categories alongside their children nested arrays
  async listActiveServices() {
    return prisma.category.findMany({
      where: { isActive: true },
      include: {
        services: {
          where: { isActive: true }
        }
      }
    });
  },

  async getServiceById(id) {
    return prisma.service.findUnique({
      where: { id: parseInt(id) },
      include: { category: true } // Joins category parent context data automatically
    });
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
      include: { 
        service: {
          include: { category: true } // Deep join schema queries
        } 
      },
      orderBy: { createdAt: "desc" },
    });
  },

  async getJobById(id) {
    return prisma.job.findUnique({
      where: { id: parseInt(id) },
      include: { 
        service: {
          include: { category: true }
        }, 
        client: { select: { id: true, name: true, email: true } },
        bids: {
          include: {
            technician: {
              select: { name: true, phone: true } // Joins matching identity records dynamically
            }
          },
          orderBy: { createdAt: "desc" }
        }
      },
    });
  },

  async getAvailableJobs() {
    return prisma.job.findMany({
      where: { status: "PENDING" },
      include: { 
        service: {
          include: { category: true } // Deep join schema to resolve service and category name
        } 
      },
      orderBy: { createdAt: "desc" },
    });
  },
};