// src/controllers/adminController.js
import prisma from "../lib/prisma.js";
import bcrypt from "bcrypt";
import cloudinary from "../config/cloudinary.js";
import fs from "fs";

export const renderOnboardingForm = (req, res) => {
  res.render("onboard-technician");
};

export const adminCreateTechnician = async (req, res, next) => {
  try {
    const { name, phone, cnicNumber, skillCategory, city, plainPassword, latitude, longitude } = req.body;
    
    if (!name || !phone || !cnicNumber || !plainPassword || !req.file || !latitude || !longitude) {
      return res.status(400).send("Core parameters, technician coordinates, or profile image file missing.");
    }

    // 1. Core Upload Processing (Safely Outside DB Connections)
    const cloudUpload = await cloudinary.uploader.upload(req.file.path, {
      folder: "karigar_fleet_selfies",
    });

    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    // 2. Sequential Query Operations (Eliminating Transaction Deadlocks)
    let newUser;
    try {
      newUser = await prisma.user.create({
        data: {
          name,
          email: `${phone}@karigar.com`,
          phone,
          password: hashedPassword,
          role: "TECHNICIAN",
        },
      });
    } catch (userError) {
      console.error("User allocation failed:", userError);
      return res.status(500).send("Failed to allocate initial user authentication profiles.");
    }

    // 3. Dependent Generation Step (Runs safely with a locked User ID)
    const currentCity = city || "Mardan";
    const formattedId = `KG-${currentCity.substring(0,3).toUpperCase()}-2026-${String(newUser.id).padStart(3, '0')}`;

    try {
      await prisma.technician.create({
        data: {
          id: newUser.id, // Maps directly to the established User ID row
          name,
          phone,
          skillCategory: skillCategory || "General Maintenance",
          city: currentCity,
          cnicNumber,
          cnicImageUrl: "VERIFIED_MANUALLY_VIA_WHATSAPP",
          selfieImageUrl: cloudUpload.secure_url,
          verificationStatus: "VERIFIED",
          isVerified: true,
          whatsappGroupName: formattedId,
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude)
        }
      });
    } catch (techError) {
      console.error("Technician compilation failed, initiating automatic rollback:", techError);
      // Rollback: Delete the orphaned user row to keep the database clean
      await prisma.user.delete({ where: { id: newUser.id } });
      return res.status(500).send("Database processing error. User creation has been safely rolled back.");
    }

    return res.render("onboard-success", { 
      name: newUser.name,
      usernameKey: formattedId, 
      systemEmail: newUser.email,
      password: plainPassword
    });
  } catch (err) {
    next(err);
  }
};


export const onboardTechnician = async (req, res) => {
  try {
    const { name, phone, skillCategory, city, cnicNumber, selfieImageUrl, latitude, longitude } = req.body;
    const profileAvatar = selfieImageUrl || "https://cdn-icons-png.flaticon.com/512/149/149071.png";

    const createdUser = await prisma.user.create({
      data: {
        name,
        phone,
        email: `${phone}@karigar.com`,
        password: "hashed_default_password", 
        role: "TECHNICIAN",
        isPhoneVerified: true
      }
    });

    try {
      await prisma.technician.create({
        data: {
          id: createdUser.id,
          name,
          phone,
          skillCategory,
          city,
          cnicNumber,
          selfieImageUrl: profileAvatar,
          verificationStatus: "VERIFIED",
          isVerified: true,
          latitude: latitude ? parseFloat(latitude) : null,
          longitude: longitude ? parseFloat(longitude) : null
        }
      });
    } catch (techErr) {
      await prisma.user.delete({ where: { id: createdUser.id } });
      throw techErr;
    }

    return res.render("onboard-success", { name, phone });
  } catch (error) {
    console.error("Onboarding crash:", error);
    return res.status(500).send("Failed to save technician profile configuration parameters.");
  }
};
