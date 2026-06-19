import express from "express";
import bcrypt from "bcrypt";
import prisma from "../lib/prisma.js";
import { adminSessionMiddleware } from "../middleware/adminSessionMiddleware.js";

const router = express.Router();
router.use(adminSessionMiddleware);

// GET /admin/login
router.get("/login", (req, res) => {
  if (req.session.isAdmin) return res.redirect("/admin/dashboard");
  res.render("pages/login", { error: null });
});

// POST /admin/login (Session-based Auth)
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    
    if (!user || user.role !== "ADMIN") {
      return res.render("pages/login", { error: "Access Denied: Invalid credentials or role permissions" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.render("pages/login", { error: "Invalid email or password" });
    }

    // Set Session State
    req.session.isAdmin = true;
    req.session.adminUser = { id: user.id, name: user.name, email: user.email };

    return res.redirect("/admin/dashboard");
  } catch (error) {
    return res.render("pages/login", { error: "An unexpected error occurred" });
  }
});

// GET /admin/logout
router.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/admin/login");
  });
});

// GET /admin/dashboard (Protected)
router.get("/dashboard", adminSessionMiddleware, async (req, res, next) => {
  try {
    // Collect metrics by counting job statuses
    const jobCounts = await prisma.job.groupBy({
      by: ["status"],
      _count: { status: true }
    });

    const stats = { PENDING: 0, POSTED: 0, MATCHED: 0, COMPLETED: 0, CANCELLED: 0 };
    jobCounts.forEach(item => {
      if (stats[item.status] !== undefined) {
        stats[item.status] = item._count.status;
      }
    });

    res.render("pages/dashboard", {
      admin: req.session.adminUser,
      stats
    });
  } catch (err) {
    next(err);
  }
});

router.get("/jobs", async (req, res, next) => {
  try {
    const { status } = req.query;
    
    const filter = status ? { status } : {};
    const jobs = await prisma.job.findMany({
      where: filter,
      include: { client: true, service: true },
      orderBy: { createdAt: "desc" }
    });

    res.render("pages/jobs_list", { admin: req.session.adminUser, jobs, currentStatus: status || "" });
  } catch (err) {
    next(err);
  }
});

router.get("/jobs/:id", async (req, res, next) => {
  try {
    const jobId = parseInt(req.params.id);
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: { client: true, service: true, matches: { include: { technician: true } } }
    });

    if (!job) return res.status(404).send("Job profile not found");

    // Fetch technicians matching criteria for the dropdown matrix
    const technicians = await prisma.technician.findMany({
      orderBy: { name: "asc" }
    });

    res.render("pages/job_detail", { admin: req.session.adminUser, job, technicians });
  } catch (err) {
    next(err);
  }
});

router.post("/jobs/:id/post", async (req, res, next) => {
  try {
    const jobId = parseInt(req.params.id);
    await prisma.job.update({
      where: { id: jobId },
      data: { status: "POSTED" }
    });
    res.redirect(`/admin/jobs/${jobId}`);
  } catch (err) {
    next(err);
  }
});

router.get("/technicians", async (req, res, next) => {
  try {
    const { city, skillCategory } = req.query;
    const filter = {};
    if (city) filter.city = city;
    if (skillCategory) filter.skillCategory = skillCategory;

    const technicians = await prisma.technician.findMany({
      where: filter,
      orderBy: { createdAt: "desc" }
    });

    res.render("pages/technicians_list", { 
      admin: req.session.adminUser, 
      technicians, 
      currentCity: city || "", 
      currentSkill: skillCategory || "" 
    });
  } catch (err) {
    next(err);
  }
});

// POST /admin/technicians (Create record)
router.post("/technicians", async (req, res, next) => {
  try {
    const { name, phone, skillCategory, city, whatsappGroupName } = req.body;
    await prisma.technician.create({
      data: { name, phone, skillCategory, city, whatsappGroupName }
    });
    res.redirect("/admin/technicians");
  } catch (err) {
    next(err);
  }
});

// POST /admin/technicians/:id/edit (Update details)
router.post("/technicians/:id/edit", async (req, res, next) => {
  try {
    const techId = parseInt(req.params.id);
    const { name, phone, skillCategory, city, whatsappGroupName, isVerified } = req.body;
    await prisma.technician.update({
      where: { id: techId },
      data: { 
        name, 
        phone, 
        skillCategory, 
        city, 
        whatsappGroupName,
        isVerified: isVerified === "true"
      }
    });
    res.redirect("/admin/technicians");
  } catch (err) {
    next(err);
  }
});

// POST /admin/jobs/:id/match (Log response & capture financial attributes)
router.post("/jobs/:id/match", async (req, res, next) => {
  try {
    const jobId = parseInt(req.params.id);
    const { technicianId, commissionAmount, commissionPaid, releaseContact } = req.body;

    const parsedTechId = parseInt(technicianId);
    const parsedAmount = parseFloat(commissionAmount || 0);
    const isPaid = commissionPaid === "on";

    // Find if a match entity already exists or build a new one
    const existingMatch = await prisma.jobMatch.findFirst({
      where: { jobId, technicianId: parsedTechId }
    });

    let matchStatus = "PENDING";
    if (isPaid) matchStatus = "COMMISSION_PAID";
    if (releaseContact === "on" && isPaid) matchStatus = "CONTACT_SHARED";

    const updateData = {
      commissionAmount: parsedAmount,
      commissionPaid: isPaid,
      status: matchStatus,
      contactSharedAt: (releaseContact === "on" && isPaid) ? new Date() : null
    };

    if (existingMatch) {
      await prisma.jobMatch.update({
        where: { id: existingMatch.id },
        data: updateData
      });
    } else {
      await prisma.jobMatch.create({
        data: {
          jobId,
          technicianId: parsedTechId,
          ...updateData
        }
      });
    }

    // Cascade update the parent Job status tracking
    if (matchStatus === "CONTACT_SHARED") {
      await prisma.job.update({ where: { id: jobId }, data: { status: "MATCHED" } });
    }

    res.redirect(`/admin/jobs/${jobId}`);
  } catch (err) {
    next(err);
  }
});



export default router;