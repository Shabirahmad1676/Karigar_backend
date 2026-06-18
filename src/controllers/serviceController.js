import prisma from "../lib/prisma.js";

export const getServices = async (req, res, next) => {
  try {
    const services = await prisma.service.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    res.status(200).json(services);
  } catch (err) {
    next(err);
  }
};