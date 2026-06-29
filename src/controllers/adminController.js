import prisma from "../lib/prisma.js";
import bcrypt from "bcrypt";

export const renderOnboardingForm = (req, res) => {
  res.render("onboard-technician"); 
};

export const adminCreateTechnician = async (req, res, next) => {
  try {
    const { name, phone, cnicNumber, skillCategory, city, plainPassword } = req.body;

    if (!name || !phone || !cnicNumber || !plainPassword) {
      return res.status(400).send("Core administrative input parameters are missing.");
    }

    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    // Multi-Table Transaction Block enforces strict relational integrity
    const result = await prisma.$transaction(async (tx) => {
      // 1. Core user table authentication account registration 
      const newUser = await tx.user.create({
        data: {
          name,
          email: `${phone}@karigar.com`, // Auto-generated fallback internal system email
          phone,
          password: hashedPassword,
          role: "TECHNICIAN",
        },
      });

      // 2. Generate custom university roll-number-style serial tracker string
      const formattedId = `KG-${city.substring(0,3).toUpperCase()}-2026-${String(newUser.id).padStart(3, '0')}`;

      // 3. Populate matching verified profile parameters cleanly
      await tx.technician.create({
        data: {
          id: newUser.id,
          name,
          phone,
          skillCategory: skillCategory || "General Maintenance",
          city: city || "Mardan",
          cnicNumber,
          cnicImageUrl: "VERIFIED_MANUALLY_VIA_WHATSAPP",
          selfieImageUrl: "VERIFIED_MANUALLY_VIA_WHATSAPP",
          verificationStatus: "VERIFIED", // Bypass in-app queue gatekeepers
          isVerified: true,
          whatsappGroupName: formattedId // Store generated user ID credentials safely inside this slot
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

  } catch (err) {
    next(err);
  }
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