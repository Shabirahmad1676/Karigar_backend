import prisma from "../lib/prisma.js";
import bcrypt from "bcrypt";
import { generateToken } from "../utils/generateToken.js";


export const register = async (req, res) => {
  try {
    const { name, email, phone, password, role, skillCategory, city } = req.body;
    
    if (!name || !email || !phone || !password || !role) {
      return res.status(400).json({ message: "All core fields are required" });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Dynamic relational execution block
    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          name,
          email,
          phone,
          password: hashedPassword,
          role: role === "TECHNICIAN" ? "TECHNICIAN" : "CLIENT",
        },
      });

      // If signing up as an on-demand specialist, spawn their fleet profile automatically
      if (role === "TECHNICIAN") {
        await tx.technician.create({
          data: {
            id: newUser.id, // Keep IDs identical or relate them via a Foreign Key row depending on schema
            name,
            phone,
            skillCategory: skillCategory || "General Maintenance",
            city: city || "Mardan",
          }
        });
      }
      return newUser;
    });

    const token = generateToken(user);
    return res.status(201).json({
      message: "Profile created successfully",
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = generateToken(user);

    return res.status(200).json({
      message: "Login successful",
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};