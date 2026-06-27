import express from "express";
import { renderOnboardingForm, adminCreateTechnician } from "../controllers/adminController.js";

const router = express.Router();

// Laptop UI controller route allocations
router.get("/onboard", renderOnboardingForm);
router.post("/onboard", adminCreateTechnician);

export default router;