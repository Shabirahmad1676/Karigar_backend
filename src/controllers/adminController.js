import prisma from "../lib/prisma.js";
import bcrypt from "bcrypt";
import cloudinary from "../config/cloudinary.js";
import fs from "fs";

export const renderOnboardingForm = (req, res) => {
  res.render("onboard-technician"); 
};

export const adminCreateTechnician = async (req, res, next) => {
  try {
    const { name, phone, cnicNumber, skillCategory, city, plainPassword } = req.body;

    if (!name || !phone || !cnicNumber || !plainPassword || !req.file) {
      return res.status(400).send("Core parameters or technician profile image file missing.");
    }

    // 1. Stream binary image up to Cloudinary securely
    const cloudUpload = await cloudinary.uploader.upload(req.file.path, {
      folder: "karigar_fleet_selfies",
    });

    // Clean local upload scratch space safely
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    const result = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          name,
          email: `${phone}@karigar.com`,
          phone,
          password: hashedPassword,
          role: "TECHNICIAN",
        },
      });

      const formattedId = `KG-${city.substring(0,3).toUpperCase()}-2026-${String(newUser.id).padStart(3, '0')}`;

      await tx.technician.create({
        data: {
          id: newUser.id,
          name,
          phone,
          skillCategory: skillCategory || "General Maintenance",
          city: city || "Mardan",
          cnicNumber,
          cnicImageUrl: "VERIFIED_MANUALLY_VIA_WHATSAPP",
          selfieImageUrl: cloudUpload.secure_url,
          verificationStatus: "VERIFIED",
          isVerified: true,
          whatsappGroupName: formattedId
        }
      });

      return { usernameId: formattedId, user: newUser };
    });

    return res.render("onboard-success", { 
      name: result.user.name,
      usernameKey: result.usernameId, 
      systemEmail: result.user.email,
      password: plainPassword
    });
  } catch (err) { next(err); }
};

export const onboardTechnician = async (req, res) => {
  try {
    const { name, phone, skillCategory, city, cnicNumber, selfieImageUrl } = req.body;

    // Use a clean fallback placeholder link if the administrator leaves the photo field empty
    const profileAvatar = selfieImageUrl || "https://cdn-icons-png.flaticon.com/512/149/149071.png";

    await prisma.$transaction(async (tx) => {
      // 1. Provisions account record entry values inside the general identity User table
      await tx.user.create({
        data: {
          name,
          phone,
          email: `${phone}@karigar.com`,
          password: "hashed_default_password", // Safe baseline profile initialization placeholder string
          role: "TECHNICIAN",
          isPhoneVerified: true
        }
      });

      // 2. Maps companion attributes seamlessly inside the technical fleet table catalog lines
      await tx.technician.create({
        data: {
          name,
          phone,
          skillCategory,
          city,
          cnicNumber,
          selfieImageUrl: profileAvatar, // 👈 Saved cleanly to database
          verificationStatus: "VERIFIED",
          isVerified: true
        }
      });
    });

    return res.render("onboard-success", { name, phone });
  } catch (error) {
    console.error("Onboarding crash:", error);
    return res.status(500).send("Failed to save technician profile configuration parameters.");
  }
};