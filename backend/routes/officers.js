// routes/officers.js
const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const Officer = require("../models/Officer");
const Department = require("../models/Department");
const Complaint = require("../models/Complaint");

function stripAnonymous(complaint, viewerIsOwner = false) {
  if (!complaint) return complaint;
  const c = typeof complaint.toObject === 'function' ? complaint.toObject() : { ...complaint };
  if (!c.isAnonymous || viewerIsOwner) return c;
  if (c.citizenId && typeof c.citizenId === 'object') {
    c.citizenId = {
      _id:   c.citizenId._id,
      name:  'Anonymous',
      email: null,
      phone: null,
    };
  }
  return c;
}

// ── Nodemailer transporter ─────────────────────────────────────
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
});

// ── Welcome email — sends credentials directly ────────────────
function buildWelcomeEmail(officer, plainPassword) {
  return [
    "<html><body style='font-family:Arial,sans-serif;background:#f4f6f9;margin:0;padding:40px 20px;'>",
    "<div style='max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);'>",
    "<div style='background:linear-gradient(135deg,#1e3a5f,#2563eb);padding:36px 40px;text-align:center;'>",
    "<span style='font-size:24px;font-weight:700;color:#fff;'>City<span style='color:#93c5fd;'>Fix</span></span>",
    "<p style='color:#bfdbfe;margin:8px 0 0;font-size:14px;'>Complaint Management System</p></div>",
    "<div style='background:#f0fdf4;border-bottom:2px solid #bbf7d0;padding:20px 40px;text-align:center;'>",
    "<div style='font-size:32px;'>&#128110;</div>",
    "<h2 style='color:#15803d;font-size:20px;margin:8px 0 4px;'>Welcome to CityFix!</h2>",
    "<p style='color:#166534;font-size:14px;margin:0;'>Your officer account has been created.</p></div>",
    "<div style='padding:36px 40px;'>",
    "<p style='color:#374151;font-size:15px;'>Dear <strong>" + officer.name + "</strong>,</p>",
    "<p style='color:#374151;font-size:14px;line-height:1.7;margin-bottom:20px;'>Your CityFix officer account is ready. Use the credentials below to log in.</p>",
    "<div style='background:#eff6ff;border:1.5px dashed #3b82f6;border-radius:12px;padding:20px 24px;margin-bottom:24px;'>",
    "<table cellpadding='0' cellspacing='0' width='100%'>",
    "<tr><td style='padding:7px 0;font-size:13px;color:#6b7280;width:130px;'>Officer ID</td>",
    "    <td style='padding:7px 0;font-size:14px;font-weight:800;color:#1d4ed8;'>" + officer.officerId + "</td></tr>",
    "<tr><td style='padding:7px 0;font-size:13px;color:#6b7280;'>Email</td>",
    "    <td style='padding:7px 0;font-size:14px;color:#111827;font-weight:600;'>" + officer.email + "</td></tr>",
    "<tr><td style='padding:7px 0;font-size:13px;color:#6b7280;'>Password</td>",
    "    <td style='padding:7px 0;font-size:14px;color:#111827;font-weight:700;font-family:monospace;background:#f0f4ff;padding:4px 10px;border-radius:6px;'>" + plainPassword + "</td></tr>",
    "<tr><td style='padding:7px 0;font-size:13px;color:#6b7280;'>Department</td>",
    "    <td style='padding:7px 0;font-size:14px;color:#111827;'>" + officer.departmentName + "</td></tr>",
    "<tr><td style='padding:7px 0;font-size:13px;color:#6b7280;'>Designation</td>",
    "    <td style='padding:7px 0;font-size:14px;color:#111827;'>" + officer.designation + "</td></tr>",
    "</table></div>",
    "<div style='background:#fefce8;border:1.5px solid #fde68a;border-radius:10px;padding:16px 20px;margin-bottom:16px;'>",
    "<p style='margin:0 0 6px;font-size:13px;font-weight:700;color:#92400e;'>Important</p>",
    "<p style='margin:0;font-size:13px;color:#78350f;line-height:1.7;'>Please log in and change your password immediately for security. Do not share these credentials with anyone.</p></div>",
    "</div>",
    "<div style='background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 40px;text-align:center;'>",
    "<p style='margin:0;font-size:12px;color:#9ca3af;'>CityFix - Automated notification. Do not reply.</p></div>",
    "</div></body></html>"
  ].join("");
}

// ── Helper: generate next officerId ───────────────────────────
async function generateOfficerId() {
  const last = await Officer.findOne().sort({ createdAt: -1 });
  if (!last || !last.officerId) return "OFF001";
  const num = parseInt(last.officerId.replace("OFF", "")) || 0;
  return "OFF" + String(num + 1).padStart(3, "0");
}

// ── GET all officers ───────────────────────────────────────────
router.get("/officers", async (_req, res) => {
  try {
    const officers = await Officer.find()
      .populate("department", "name code")
      .sort({ createdAt: -1 });
    res.json(officers);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch officers", error: err.message });
  }
});

// ── GET officers by department name (MUST be before /:id) ──────
// Optional ?level=1 filters to L1 only; omit for all levels
router.get("/officers/by-department/:deptName", async (req, res) => {
  try {
    const filter = { departmentName: req.params.deptName, status: "Active" };
    if (req.query.level) {
      const lvl = parseInt(req.query.level, 10);
      if (!isNaN(lvl)) filter.level = lvl;
    }
    const officers = await Officer.find(filter)
      .select("name designation level departmentName supervisorId")
      .sort({ level: 1, name: 1 });
    res.json(officers);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch officers by department", error: err.message });
  }
});

// ── GET single officer by officerId or _id ───────────────────────
router.get("/officers/:id", async (req, res) => {
  try {
    let officer = await Officer.findOne({ officerId: req.params.id }).populate("department", "name code");
    if (!officer && req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      officer = await Officer.findById(req.params.id).populate("department", "name code");
    }
    if (!officer) return res.status(404).json({ message: "Officer not found" });
    res.json(officer);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET complaints assigned to an officer ──────────────────────
router.get("/officers/:id/complaints", async (req, res) => {
  try {
    let officer = await Officer.findOne({ officerId: req.params.id });
    if (!officer && req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      officer = await Officer.findById(req.params.id);
    }
    if (!officer) return res.status(404).json({ message: "Officer not found" });

    const complaints = await Complaint.find({ officerId: officer._id })
      .populate("citizenId", "name email phone")
      .sort({ createdAt: -1 });

    // Strip citizen identity from anonymous complaints — officers must not see it
    res.json(complaints.map(c => stripAnonymous(c)));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST create new officer ────────────────────────────────────
// No longer sends password in email — sends a secure set-password link
router.post("/officers", async (req, res) => {
  try {
    const { name, email, phone, department, designation, joinDate, password, level } = req.body;

    if (!name || !email || !phone || !department || !designation || !joinDate || !password) {
      return res.status(400).json({ message: "All fields are required." });
    }

    const dept = await Department.findById(department);
    if (!dept) return res.status(404).json({ message: "Department not found." });

    const existingEmail = await Officer.findOne({ email: email.toLowerCase() });
    if (existingEmail) return res.status(409).json({ message: `Email "${email}" is already registered.` });

    const officerId = await generateOfficerId();
    const hashed = await bcrypt.hash(password, 10);

    // No token needed for creation (plain credentials sent by email)

    const officer = await Officer.create({
      officerId,
      name,
      email,
      phone,
      password: hashed,
      designation,
      department: dept._id,
      departmentName: dept.name,
      joinDate,
      level: Number(level) || 1,
      status: "Active",
      casesHandled: 0,
      casesResolved: 0,
      passwordSet: false,
    });

    await Department.findByIdAndUpdate(dept._id, {
      $inc: { totalOfficers: 1, activeOfficers: 1 }
    });

    const populated = await officer.populate("department", "name code");

    // Build set-password link and send welcome email (non-fatal)
    try {
      if (officer.email && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        await transporter.sendMail({
          from: "CityFix <" + process.env.EMAIL_USER + ">",
          to: officer.email,
          subject: "Welcome to CityFix - Your Login Credentials | " + officer.officerId,
          html: buildWelcomeEmail(officer, password),
        });
        console.log("Welcome email sent to officer: " + officer.email);
      }
    } catch (emailErr) {
      console.error("Officer welcome email failed (non-fatal):", emailErr.message);
    }

    res.status(201).json({ message: "Officer created successfully. Welcome email sent.", officer: populated });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: "Duplicate email." });
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ── GET /officers/verify-token/:token ─────────────────────────
// Called by set-password.html to verify the token is valid before showing the form
router.get("/officers/verify-token/:token", async (req, res) => {
  try {
    const officer = await Officer.findOne({
      resetToken: req.params.token,
      resetTokenExpiry: { $gt: new Date() }, // not expired
    });

    if (!officer) {
      return res.status(400).json({ message: "This link is invalid or has expired. Please ask your admin to resend the invitation." });
    }

    res.json({ valid: true, name: officer.name, email: officer.email, officerId: officer.officerId });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST /officers/set-password ────────────────────────────────
// Officer submits new password via the set-password page
router.post("/officers/set-password", async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ message: "Token and password are required." });
    }
    if (password.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters." });
    }

    const officer = await Officer.findOne({
      resetToken: token,
      resetTokenExpiry: { $gt: new Date() },
    });

    if (!officer) {
      return res.status(400).json({ message: "This link is invalid or has expired." });
    }

    // Update password and clear the token
    officer.password = await bcrypt.hash(password, 10);
    officer.resetToken = null;
    officer.resetTokenExpiry = null;
    officer.passwordSet = true;
    await officer.save();

    res.json({ message: "Password set successfully! You can now log in to CityFix." });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── DELETE officer ─────────────────────────────────────────────
router.delete("/officers/:id", async (req, res) => {
  try {
    const deleted = await Officer.findOneAndDelete({ officerId: req.params.id });
    if (!deleted) return res.status(404).json({ message: "Officer not found" });

    await Department.findByIdAndUpdate(deleted.department, {
      $inc: {
        totalOfficers: -1,
        activeOfficers: deleted.status === "Active" ? -1 : 0,
      },
    });

    res.json({ message: "Officer removed successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── PATCH /officers/:id  —  Update officer profile (name, phone, designation) ──
router.patch("/officers/:id", async (req, res) => {
  try {
    const { name, phone, designation } = req.body;
    const update = {};
    if (name)        update.name        = name.trim();
    if (phone)       update.phone       = phone.trim();
    if (designation) update.designation = designation.trim();

    let officer = await Officer.findOne({ officerId: req.params.id });
    if (!officer && req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      officer = await Officer.findById(req.params.id);
    }
    if (!officer) return res.status(404).json({ message: "Officer not found." });

    const updated = await Officer.findByIdAndUpdate(officer._id, update, { new: true })
      .populate("department", "name code");

    res.json({ message: "Profile updated successfully.", officer: updated });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── PATCH /officers/:id/status ─────────────────────────────────
router.patch("/officers/:id/status", async (req, res) => {
  try {
    const { status } = req.body; // "Active" | "On Leave"
    // Try to find by officerId string (e.g. "OFF031") first, then by MongoDB _id
    let officer = await Officer.findOne({ officerId: req.params.id });
    if (!officer && req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      officer = await Officer.findById(req.params.id);
    }
    if (!officer) return res.status(404).json({ message: "Officer not found" });

    const wasActive = officer.status === "Active";
    const isActive  = status === "Active";

    officer.status = status;
    await officer.save();

    if (isActive && !wasActive) {
      await Department.findByIdAndUpdate(officer.department, { $inc: { activeOfficers: 1 } });
    } else if (!isActive && wasActive) {
      await Department.findByIdAndUpdate(officer.department, { $inc: { activeOfficers: -1 } });
    }

    res.json({ message: "Officer status updated", officer });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── PATCH /api/officers/:id/change-password ────────────────────
router.patch("/officers/:id/change-password", async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Both current and new password are required." });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ message: "New password must be at least 8 characters." });
    }

    let officer = await Officer.findOne({ officerId: req.params.id }).select("+password");
    if (!officer && req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      officer = await Officer.findById(req.params.id).select("+password");
    }
    if (!officer) return res.status(404).json({ message: "Officer not found." });

    const match = await bcrypt.compare(currentPassword, officer.password);
    if (!match) return res.status(401).json({ message: "Current password is incorrect." });

    officer.password = await bcrypt.hash(newPassword, 10);
    await officer.save();

    res.json({ message: "Password updated successfully." });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── PATCH /api/officers/:id/update-profile ──────────────────────
// Officer updates their own name and phone (not email, not officerId)
router.patch("/officers/:id/update-profile", async (req, res) => {
  try {
    const { name, phone } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Name cannot be empty." });
    }

    // Find by officerId string (e.g. "OFF001") or MongoDB _id
    let officer = await Officer.findOne({ officerId: req.params.id });
    if (!officer && req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      officer = await Officer.findById(req.params.id);
    }
    if (!officer) return res.status(404).json({ message: "Officer not found." });

    officer.name  = name.trim();
    if (phone) officer.phone = phone.trim();
    await officer.save();

    res.json({ message: "Profile updated successfully.", officer });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ──────────────────────────────────────────────
// GET /api/officers/by-department/:dept
// Returns active officers for a department.
// Optional query: ?level=1  → only L1 officers (for initial assignment)
//                 (omit)    → all levels (for reassignment)
// ──────────────────────────────────────────────
router.get("/officers/by-department/:dept", async (req, res) => {
  try {
    const dept = req.params.dept;
    const filter = { departmentName: dept, status: "Active" };
    if (req.query.level) {
      const lvl = parseInt(req.query.level, 10);
      if (!isNaN(lvl)) filter.level = lvl;
    }
    const officers = await Officer.find(filter)
      .select("name designation level departmentName supervisorId")
      .sort({ level: 1, name: 1 });
    res.json(officers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ──────────────────────────────────────────────────────────────
// PATCH /api/officers/:id/assign-supervisor
// Assigns a supervisor (L2 for L1, or L3 for L2) to an officer
// Body: { supervisorId }
// ──────────────────────────────────────────────────────────────
router.patch("/officers/:id/assign-supervisor", async (req, res) => {
  try {
    const { supervisorId } = req.body;

    // Find the officer to assign a supervisor to
    let officer = await Officer.findOne({ officerId: req.params.id });
    if (!officer && req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      officer = await Officer.findById(req.params.id);
    }
    if (!officer) return res.status(404).json({ message: "Officer not found." });

    // Validate supervisor exists and is at correct level
    const supervisor = await Officer.findById(supervisorId);
    if (!supervisor) return res.status(404).json({ message: "Supervisor officer not found." });

    if (supervisor.level !== officer.level + 1) {
      return res.status(400).json({
        message: `Supervisor must be at Level ${officer.level + 1} (one above the officer's Level ${officer.level}).`,
      });
    }

    // Same department check
    if (supervisor.departmentName !== officer.departmentName) {
      return res.status(400).json({ message: "Supervisor must be in the same department." });
    }

    officer.supervisorId = supervisor._id;
    await officer.save();

    res.json({
      message: `${officer.name} (L${officer.level}) is now supervised by ${supervisor.name} (L${supervisor.level}).`,
      officer,
      supervisor,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ──────────────────────────────────────────────────────────────
// DELETE /api/officers/:id/assign-supervisor
// Removes the supervisor assignment from an officer
// ──────────────────────────────────────────────────────────────
router.delete("/officers/:id/assign-supervisor", async (req, res) => {
  try {
    let officer = await Officer.findOne({ officerId: req.params.id });
    if (!officer && req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      officer = await Officer.findById(req.params.id);
    }
    if (!officer) return res.status(404).json({ message: "Officer not found." });

    officer.supervisorId = null;
    await officer.save();
    res.json({ message: `Supervisor assignment removed from ${officer.name}.`, officer });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ──────────────────────────────────────────────────────────────
// GET /api/officers/:id/subordinates
// Returns all officers supervised by this officer
// ──────────────────────────────────────────────────────────────
router.get("/officers/:id/subordinates", async (req, res) => {
  try {
    let officer = await Officer.findOne({ officerId: req.params.id });
    if (!officer && req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      officer = await Officer.findById(req.params.id);
    }
    if (!officer) return res.status(404).json({ message: "Officer not found." });

    const subordinates = await Officer.find({ supervisorId: officer._id })
      .select("name designation level departmentName officerId status supervisorId")
      .sort({ name: 1 });

    res.json(subordinates);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ──────────────────────────────────────────────────────────────
// GET /api/hierarchy/:deptName
// Returns the full hierarchy tree for a department
// { l3Officers: [{...officer, l2Officers:[{...officer, l1Officers:[...]}]}] }
// ──────────────────────────────────────────────────────────────
router.get("/hierarchy/:deptName", async (req, res) => {
  try {
    const dept = decodeURIComponent(req.params.deptName);
    const allOfficers = await Officer.find({ departmentName: dept })
      .select("_id officerId name designation level status supervisorId casesHandled casesResolved")
      .sort({ level: -1, name: 1 });

    const l3 = allOfficers.filter(o => o.level === 3);
    const l2 = allOfficers.filter(o => o.level === 2);
    const l1 = allOfficers.filter(o => o.level === 1);

    // Build unassigned list (officers with no supervisor in relevant levels)
    const assignedL1Ids = new Set(l1.filter(o => o.supervisorId).map(o => o._id.toString()));
    const assignedL2Ids = new Set(l2.filter(o => o.supervisorId).map(o => o._id.toString()));

    const tree = l3.map(l3o => ({
      ...l3o.toObject(),
      l2Officers: l2.filter(l2o => l2o.supervisorId?.toString() === l3o._id.toString()).map(l2o => ({
        ...l2o.toObject(),
        l1Officers: l1.filter(l1o => l1o.supervisorId?.toString() === l2o._id.toString()),
      })),
    }));

    const unassignedL2 = l2.filter(o => !o.supervisorId);
    const unassignedL1 = l1.filter(o => !o.supervisorId);

    res.json({ tree, unassignedL2, unassignedL1, allL1: l1, allL2: l2, allL3: l3 });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;