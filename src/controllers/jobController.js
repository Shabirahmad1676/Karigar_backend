import prisma from "../lib/prisma.js";
import { getIO } from "../socket/socket.js";



export const getJobs = async (req, res,next) => {
  try {
    const jobs = await prisma.job.findMany({
      include: {
        client: {
          select: { id: true, name: true, email: true, role: true },
        },
        bids: {
          include: {
            technician: {
              select: { id: true, name: true, email: true, role: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(jobs);
  } catch (err) {
    next(err);
  }
};

// @desc    Create a new job posting
// @route   POST /api/jobs
export const createJob = async (req, res) => {
  try {

    if (req.user.role !== "CLIENT") {
      return res.status(403).json({
        message: "Only clients can create jobs",
      });
    }


    const { title, description, budget, clientId } = req.body;

    // Verify user exists and is a CLIENT
    const user = await prisma.user.findUnique({ where: { id: clientId } });
    if (!user || user.role !== "CLIENT") {
      return res.status(403).json({ error: "Only accounts registered as CLIENT can post jobs" });
    }

    const job = await prisma.job.create({
      data: { title, description, budget, clientId:req.user.id },
    });

    const io = getIO();

io.emit("new_job_available", job);

    res.status(201).json(job);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
