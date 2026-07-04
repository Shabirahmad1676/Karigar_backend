import express from "express";
import { renderOnboardingForm, adminCreateTechnician } from "../controllers/adminController.js";
import { upload } from "../config/multer.js"; 

const router = express.Router();

router.get("/onboard", renderOnboardingForm);
router.post("/onboard", upload.single("selfieImageFile"), adminCreateTechnician);

export default router;