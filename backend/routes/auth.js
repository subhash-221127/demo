// routes/auth.js
const express          = require("express");
const router           = require("express").Router();
const bcrypt           = require("bcryptjs");
const jwt              = require("jsonwebtoken");
const nodemailer       = require("nodemailer");
const { OAuth2Client } = require("google-auth-library");
const User             = require("../models/User");
const Officer          = require("../models/Officer");
const Admin            = require("../models/Admin");

const JWT_SECRET       = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error("JWT_SECRET environment variable is not set!");
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "133830687101-eb9ln27rrftt10dcstl698ldkr7djj7a.apps.googleusercontent.com";

// ── OTP Stores ─────────────────────────────────────────────────
const otpStore       = {};  // signup verification OTPs
const forgotOtpStore = {};  // forgot-password OTPs

// ── Nodemailer transporter ─────────────────────────────────────
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

// ══════════════════════════════════════════════════════════════
//  SIGNUP OTP ROUTES
// ══════════════════════════════════════════════════════════════

// POST /api/send-otp
router.post("/send-otp", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required." });

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(409).json({ message: "Email already registered. Please login instead." });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore[email.toLowerCase()] = { otp, expiresAt: Date.now() + 10 * 60 * 1000 };

    await transporter.sendMail({
      from: `"CityFix" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "CityFix – Email Verification OTP",
      html: `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#f8fafc;border-radius:16px;">
          <div style="text-align:center;margin-bottom:24px;">
            <div style="display:inline-block;background:#1a3c6e;border-radius:14px;padding:12px 20px;">
              <span style="color:#fff;font-weight:800;font-size:1.3rem;">City<span style="color:#f97316;">Fix</span></span>
            </div>
          </div>
          <h2 style="color:#1e293b;font-size:1.4rem;font-weight:800;margin-bottom:8px;">Verify Your Email</h2>
          <p style="color:#64748b;margin-bottom:24px;">Use the OTP below to verify your email. It expires in <strong>10 minutes</strong>.</p>
          <div style="background:#fff;border-radius:12px;padding:24px;text-align:center;border:2px dashed #e2e8f0;margin-bottom:24px;">
            <span style="font-size:2.5rem;font-weight:900;color:#1a3c6e;letter-spacing:12px;">${otp}</span>
          </div>
          <p style="color:#94a3b8;font-size:0.8rem;">If you didn't request this, you can safely ignore this email.</p>
        </div>
      `,
    });

    res.json({ message: "OTP sent successfully. Check your email." });
  } catch (err) {
    res.status(500).json({ message: "Failed to send OTP.", error: err.message });
  }
});

// POST /api/verify-otp
router.post("/verify-otp", (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ message: "Email and OTP are required." });

  const record = otpStore[email.toLowerCase()];
  if (!record)                       return res.status(400).json({ message: "OTP not found. Please request a new one." });
  if (Date.now() > record.expiresAt) return res.status(400).json({ message: "OTP has expired. Please request a new one." });
  if (record.otp !== otp)            return res.status(400).json({ message: "Incorrect OTP. Please try again." });

  delete otpStore[email.toLowerCase()];
  res.json({ message: "Email verified successfully." });
});

// ══════════════════════════════════════════════════════════════
//  FORGOT PASSWORD ROUTES  (Citizen + Officer only)
// ══════════════════════════════════════════════════════════════

// POST /api/forgot-password
// Validates email is Citizen or Officer (blocks Admin), then sends OTP
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required." });

    const lower = email.toLowerCase();

    // Block Admin accounts from this route
    const admin = await Admin.findOne({ email: lower });
    if (admin) {
      return res.status(403).json({
        message: "Admin accounts cannot reset password here. Contact your system administrator.",
      });
    }

    // Check Citizen or Officer exists
    const user    = await User.findOne({ email: lower });
    const officer = await Officer.findOne({ email: lower });

    if (!user && !officer) {
      return res.status(404).json({ message: "No account found with this email." });
    }

    const role = user ? "Citizen" : "Officer";

    // Generate OTP and store with 10 min expiry
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    forgotOtpStore[lower] = { otp, expiresAt: Date.now() + 10 * 60 * 1000 };

    await transporter.sendMail({
      from: `"CityFix" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "CityFix – Password Reset OTP",
      html: `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#f8fafc;border-radius:16px;">
          <div style="text-align:center;margin-bottom:24px;">
            <div style="display:inline-block;background:#1a3c6e;border-radius:14px;padding:12px 20px;">
              <span style="color:#fff;font-weight:800;font-size:1.3rem;">City<span style="color:#f97316;">Fix</span></span>
            </div>
          </div>
          <h2 style="color:#1e293b;font-size:1.4rem;font-weight:800;margin-bottom:8px;">Password Reset Request</h2>
          <p style="color:#64748b;margin-bottom:8px;">Hi <strong>${role}</strong>, we received a request to reset your CityFix password.</p>
          <p style="color:#64748b;margin-bottom:24px;">Use the OTP below. It expires in <strong>10 minutes</strong>.</p>
          <div style="background:#fff;border-radius:12px;padding:24px;text-align:center;border:2px dashed #fed7aa;margin-bottom:24px;">
            <span style="font-size:2.5rem;font-weight:900;color:#f97316;letter-spacing:12px;">${otp}</span>
          </div>
          <p style="color:#94a3b8;font-size:0.8rem;">If you didn't request this, ignore this email. Your password will not change.</p>
        </div>
      `,
    });

    res.json({ message: "Password reset OTP sent. Check your email." });
  } catch (err) {
    res.status(500).json({ message: "Failed to send OTP.", error: err.message });
  }
});

// POST /api/verify-forgot-otp
// Verifies the OTP — marks as verified so reset-password can proceed
router.post("/verify-forgot-otp", (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ message: "Email and OTP are required." });

  const lower  = email.toLowerCase();
  const record = forgotOtpStore[lower];

  if (!record)                       return res.status(400).json({ message: "OTP not found. Please request a new one." });
  if (Date.now() > record.expiresAt) return res.status(400).json({ message: "OTP has expired. Please request a new one." });
  if (record.otp !== otp)            return res.status(400).json({ message: "Incorrect OTP. Please try again." });

  // Mark verified (keep in store until password is actually reset)
  forgotOtpStore[lower].verified = true;
  res.json({ message: "OTP verified. You can now reset your password." });
});

// POST /api/reset-password
// Updates password in DB for Citizen or Officer after OTP verified
router.post("/reset-password", async (req, res) => {
  try {
    const { email, newPassword } = req.body;
    if (!email || !newPassword) return res.status(400).json({ message: "Email and new password are required." });
    if (newPassword.length < 8)  return res.status(400).json({ message: "Password must be at least 8 characters." });

    const lower  = email.toLowerCase();
    const record = forgotOtpStore[lower];

    // Must have completed OTP verification
    if (!record || !record.verified) {
      return res.status(403).json({ message: "Email not verified. Please complete OTP verification first." });
    }

    const hashed = await bcrypt.hash(newPassword, 10);

    // Try Citizen first, then Officer
    const updatedUser = await User.findOneAndUpdate(
      { email: lower },
      { password: hashed },
      { new: true }
    );

    if (!updatedUser) {
      const updatedOfficer = await Officer.findOneAndUpdate(
        { email: lower },
        { password: hashed },
        { new: true }
      );
      if (!updatedOfficer) return res.status(404).json({ message: "Account not found." });
    }

    // Clear OTP record
    delete forgotOtpStore[lower];

    res.json({ message: "Password reset successfully. You can now log in with your new password." });
  } catch (err) {
    res.status(500).json({ message: "Failed to reset password.", error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════
//  REGISTER
// ══════════════════════════════════════════════════════════════

router.post("/register", async (req, res) => {
  try {
    const { name, email, phone, password, address } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email and password are required." });
    }
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(409).json({ message: "Email already registered." });

    const hashed = await bcrypt.hash(password, 10);
    const user   = await User.create({ name, email, phone, password: hashed, address, role: "citizen" });

    const token = generateToken({ id: user._id, role: "citizen" });
    res.status(201).json({
      message: "Registration successful",
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    res.status(500).json({ message: "Registration failed", error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════
//  LOGIN
// ══════════════════════════════════════════════════════════════

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }
    const lower = email.toLowerCase();

    // 1. Admin
    const admin = await Admin.findOne({ email: lower });
    if (admin) {
      const match = await bcrypt.compare(password, admin.password);
      if (!match) return res.status(401).json({ message: "Invalid credentials." });
      const token = generateToken({ id: admin._id, role: admin.role });
      return res.json({
        message: "Login successful", token,
        user: { id: admin._id, name: admin.name, email: admin.email, role: admin.role },
      });
    }

    // 2. Officer
    const officer = await Officer.findOne({ email: lower }).populate("department", "name");
    if (officer) {
      const match = await bcrypt.compare(password, officer.password);
      if (!match) return res.status(401).json({ message: "Invalid credentials." });
      const token = generateToken({ id: officer._id, officerId: officer.officerId, role: "officer" });
      return res.json({
        message: "Login successful", token,
        user: {
          id: officer._id, officerId: officer.officerId, name: officer.name,
          email: officer.email, role: "officer",
          department: officer.departmentName, designation: officer.designation,
          level: officer.level || 1,
        },
      });
    }

    // 3. Citizen
    const user = await User.findOne({ email: lower });
    if (user) {
      const match = await bcrypt.compare(password, user.password);
      if (!match) return res.status(401).json({ message: "Invalid credentials." });
      if (!user.isActive) return res.status(403).json({ message: "Account is inactive." });
      const token = generateToken({ id: user._id, role: "citizen" });
      return res.json({
        message: "Login successful", token,
        user: { id: user._id, name: user.name, email: user.email, role: "citizen" },
      });
    }

    return res.status(404).json({ message: "No account found with this email." });
  } catch (err) {
    res.status(500).json({ message: "Login failed", error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════
//  GOOGLE OAuth
// ══════════════════════════════════════════════════════════════

router.post("/auth/google", async (req, res) => {
  try {
    const client  = new OAuth2Client(GOOGLE_CLIENT_ID);
    const ticket  = await client.verifyIdToken({ idToken: req.body.credential, audience: GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    const lower   = payload.email.toLowerCase();

    const admin = await Admin.findOne({ email: lower });
    if (admin) {
      const token = generateToken({ id: admin._id, role: admin.role });
      return res.json({ token, user: { id: admin._id, name: admin.name, email: admin.email, role: admin.role } });
    }

    const officer = await Officer.findOne({ email: lower });
    if (officer) {
      if (officer.status === "On Leave") return res.status(403).json({ message: "Your account is currently on leave. Please contact admin." });
      const token = generateToken({ id: officer._id, role: "officer" });
      return res.json({ token, user: { id: officer._id, name: officer.name, email: officer.email, role: "officer" } });
    }

    let user = await User.findOne({ email: lower });
    if (!user) {
      const randomPwd = await bcrypt.hash(Math.random().toString(36) + Date.now(), 10);
      user = await User.create({ name: payload.name, email: lower, password: randomPwd });
    }
    const token = generateToken({ id: user._id, role: "citizen" });
    return res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: "citizen" } });

  } catch (err) {
    res.status(401).json({ message: "Google authentication failed", error: err.message });
  }
});

router.post("/auth/google/signup", async (req, res) => {
  try {
    const client  = new OAuth2Client(GOOGLE_CLIENT_ID);
    const ticket  = await client.verifyIdToken({ idToken: req.body.credential, audience: GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    const lower   = payload.email.toLowerCase();

    let user = await User.findOne({ email: lower });
    if (user) {
      const token = generateToken({ id: user._id, role: "citizen" });
      return res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: "citizen" } });
    }

    const randomPwd = await bcrypt.hash(Math.random().toString(36) + Date.now(), 10);
    user = await User.create({ name: payload.name, email: lower, password: randomPwd });
    const token = generateToken({ id: user._id, role: "citizen" });
    return res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: "citizen" } });

  } catch (err) {
    res.status(401).json({ message: "Google signup failed", error: err.message });
  }
});


// ── GET /api/auth/me?id=<userId> ──────────────────────────────
router.get("/auth/me", async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) return res.status(400).json({ message: "User ID required." });
    const user = await User.findById(id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found." });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── PATCH /api/auth/update-profile ───────────────────────────
router.patch("/auth/update-profile", async (req, res) => {
  try {
    const { id, name, phone, address } = req.body;
    if (!id) return res.status(400).json({ message: "User ID required." });
    const updated = await User.findByIdAndUpdate(
      id, { name, phone, address }, { new: true, runValidators: true }
    ).select("-password");
    if (!updated) return res.status(404).json({ message: "User not found." });
    res.json({ message: "Profile updated successfully.", user: updated });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── PATCH /api/auth/change-password ──────────────────────────
// Works for Citizen, Admin
router.patch("/auth/change-password", async (req, res) => {
  try {
    const { id, currentPassword, newPassword } = req.body;
    if (!id || !currentPassword || !newPassword)
      return res.status(400).json({ message: "All fields are required." });
    if (newPassword.length < 6)
      return res.status(400).json({ message: "New password must be at least 6 characters." });

    // Try Admin first, then Citizen
    let account = await Admin.findById(id);
    if (!account) account = await User.findById(id);
    if (!account) return res.status(404).json({ message: "Account not found." });

    const match = await bcrypt.compare(currentPassword, account.password);
    if (!match) return res.status(401).json({ message: "Current password is incorrect." });
    account.password = await bcrypt.hash(newPassword, 10);
    await account.save();
    res.json({ message: "Password changed successfully." });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/admin/me?id=<adminId> ───────────────────────────
router.get("/admin/me", async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) return res.status(400).json({ message: "Admin ID required." });
    const admin = await Admin.findById(id).select("-password");
    if (!admin) return res.status(404).json({ message: "Admin not found." });
    res.json(admin);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── PATCH /api/admin/me ──────────────────────────────────────
// Accepts name and phone (email cannot be changed)
router.patch("/admin/me", async (req, res) => {
  try {
    const { id, name, phone } = req.body;
    if (!id) return res.status(400).json({ message: "Admin ID required." });
    if (!name || !name.trim()) return res.status(400).json({ message: "Name cannot be empty." });
    const updates = { name: name.trim() };
    if (phone !== undefined) updates.phone = phone.trim();
    const updated = await Admin.findByIdAndUpdate(
      id, updates, { new: true }
    ).select("-password");
    if (!updated) return res.status(404).json({ message: "Admin not found." });
    res.json({ message: "Profile updated.", admin: updated });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;