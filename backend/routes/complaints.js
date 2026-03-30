// routes/complaints.js
const express      = require("express");
const multer       = require("multer");
const path         = require("path");
const fs           = require("fs");
const nodemailer   = require("nodemailer");
const fetch        = require("node-fetch");          // npm install node-fetch@2
const Complaint    = require("../models/Complaint");
const User         = require("../models/User");
const Department   = require("../models/Department");
const Officer      = require("../models/Officer");

// ─────────────────────────────────────────────
// Cloudinary + Multer storage setup
// ─────────────────────────────────────────────
const cloudinary              = require("cloudinary").v2;
const { CloudinaryStorage }   = require("multer-storage-cloudinary");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const cloudinaryStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder:         "cityfix-evidence",
    allowed_formats: ["jpg", "jpeg", "png", "webp", "gif"],
    transformation: [{ quality: "auto", fetch_format: "auto" }],
  },
});

const upload = multer({ storage: cloudinaryStorage });

const router = express.Router();

// ─────────────────────────────────────────────
// Helper — wipe citizen identity from a complaint
// when isAnonymous is true and the viewer is not
// the citizen themselves (i.e. not their own request)
// ─────────────────────────────────────────────
function stripAnonymous(complaint, viewerIsOwner = false) {
  if (!complaint) return complaint;
  // Convert mongoose doc to plain object so we can mutate it safely
  const c = typeof complaint.toObject === 'function' ? complaint.toObject() : { ...complaint };
  if (!c.isAnonymous || viewerIsOwner) return c;

  // Blank out everything that identifies the citizen
  if (c.citizenId && typeof c.citizenId === 'object') {
    c.citizenId = {
      _id:   c.citizenId._id,   // keep the id so references don't break
      name:  'Anonymous',
      email: null,
      phone: null,
    };
  }
  return c;
}

// ─────────────────────────────────────────────
// Nodemailer transporter
// ─────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// ─────────────────────────────────────────────
// Email helpers
// ─────────────────────────────────────────────
async function sendMail(to, subject, html) {
  try {
    if (!to || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) return;
    await transporter.sendMail({
      from: "CityFix <" + process.env.EMAIL_USER + ">",
      to, subject, html,
    });
    console.log("Email sent to " + to + ": " + subject);
  } catch (err) {
    console.error("Email send failed (non-fatal):", err.message);
  }
}

function buildResolvedEmail(citizen, complaint) {
  return [
    "<html><body style='font-family:Arial,sans-serif;background:#f4f6f9;margin:0;padding:40px 20px;'>",
    "<div style='max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);'>",
    "<div style='background:linear-gradient(135deg,#1e3a5f,#2563eb);padding:36px 40px;text-align:center;'>",
    "<span style='font-size:24px;font-weight:700;color:#fff;'>City<span style='color:#93c5fd;'>Fix</span></span></div>",
    "<div style='background:#f0fdf4;border-bottom:2px solid #bbf7d0;padding:20px 40px;text-align:center;'>",
    "<div style='font-size:32px;'>&#9989;</div>",
    "<h2 style='color:#15803d;font-size:20px;margin:8px 0 4px;'>Complaint Resolved</h2>",
    "<p style='color:#166534;font-size:14px;margin:0;'>Your complaint has been successfully resolved.</p></div>",
    "<div style='padding:36px 40px;'>",
    "<p style='color:#374151;font-size:15px;'>Dear <strong>" + (citizen ? citizen.name : 'Citizen') + "</strong>,<br/>",
    "Complaint <strong style='color:#1d4ed8;'>" + (complaint.complaintId || 'Unknown') + "</strong> has just been verified & closed.</p>",
    "<p style='margin-top:20px;font-size:13px;color:#6b7280;text-align:center;'>Thank you for keeping our city clean and safe.</p>",
    "</div></div></body></html>"
  ].join("");
}

// ─────────────────────────────────────────────
// Gemini AI — compare two images for similarity
// Returns { score: 0-100, passed: bool, summary: string }
// ─────────────────────────────────────────────
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

function imageToBase64(filePath) {
  const abs = path.isAbsolute(filePath) ? filePath : path.join(__dirname, "..", filePath);
  if (!fs.existsSync(abs)) return null;
  return fs.readFileSync(abs).toString("base64");
}

function getMimeType(filename) {
  const ext = path.extname(filename).toLowerCase();
  const map = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif" };
  return map[ext] || "image/jpeg";
}

async function verifyResolutionWithAI(beforeUrl, afterUrl) {
  try {
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not set in .env");

    // Fetch images from Cloudinary URLs and convert to base64
    async function urlToBase64(url) {
      const resp = await fetch(url);
      if (!resp.ok) return null;
      const buffer = await resp.buffer();
      return buffer.toString("base64");
    }

    const beforeB64 = await urlToBase64(beforeUrl);
    const afterB64  = await urlToBase64(afterUrl);

    if (!beforeB64 || !afterB64) {
      return { score: null, passed: false, summary: "Could not read one or both image files." };
    }

    function getMimeFromUrl(url) {
      const ext = url.split(".").pop().toLowerCase().split("?")[0];
      const map = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" };
      return map[ext] || "image/jpeg";
    }

    const prompt = `You are a civic complaint verification AI.
You are given TWO photos:
- Image 1: The "BEFORE" photo showing a civic problem (pothole, garbage, broken pipe, etc.) submitted by a citizen.
- Image 2: The "AFTER" photo submitted by a field officer claiming the problem is resolved.

Your task:
1. Identify whether both images appear to be from the same or similar location/scene.
2. Assess whether the problem visible in Image 1 appears to have been addressed in Image 2.
3. Give a match/resolution confidence score between 0 and 100.
   - 0–30: Completely unrelated images or problem clearly not addressed.
   - 31–69: Possibly related but insufficient evidence of resolution.
   - 70–100: Clearly same/similar location and problem appears resolved.

Respond ONLY with valid JSON in this exact format (no markdown, no explanation):
{"score": <number 0-100>, "summary": "<one sentence explanation>"}`;

    const body = {
      contents: [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type: getMimeFromUrl(beforeUrl), data: beforeB64 } },
          { inline_data: { mime_type: getMimeFromUrl(afterUrl),  data: afterB64  } },
        ]
      }]
    };

    const resp = await fetch(GEMINI_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Gemini API error ${resp.status}: ${errText}`);
    }

    const data = await resp.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Strip possible markdown fences
    const clean = text.replace(/```json|```/gi, "").trim();
    const parsed = JSON.parse(clean);
    const score  = Math.max(0, Math.min(100, Number(parsed.score) || 0));

    return { score, passed: score >= 70, summary: parsed.summary || "" };

  } catch (err) {
    console.error("AI verification error:", err.message);
    // Fail-open: if AI errors, flag for manual admin review
    return { score: null, passed: false, summary: `AI check failed: ${err.message}` };
  }
}

// ─────────────────────────────────────────────
// Email templates
// ─────────────────────────────────────────────
function buildConfirmationEmail(citizen, complaint) {
  const submittedAt = new Date(complaint.createdAt).toLocaleString("en-IN", {
    day: "2-digit", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
  const severityColor = { low:"#16a34a", medium:"#d97706", high:"#dc2626", critical:"#7c3aed" }[complaint.severity] || "#d97706";
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 20px;"><tr><td align="center">
  <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);max-width:600px;width:100%;">
  <tr><td style="background:linear-gradient(135deg,#1e3a5f,#2563eb);padding:36px 40px;text-align:center;">
    <span style="font-size:24px;font-weight:700;color:#fff;">City<span style="color:#93c5fd;">Fix</span></span>
    <p style="color:#bfdbfe;margin:12px 0 0;font-size:14px;">Complaint Management System</p></td></tr>
  <tr><td style="background:#f0fdf4;border-bottom:2px solid #bbf7d0;padding:20px 40px;text-align:center;">
    <span style="font-size:32px;">✅</span>
    <h2 style="margin:8px 0 4px;color:#15803d;font-size:20px;font-weight:700;">Complaint Submitted Successfully!</h2>
    <p style="margin:0;color:#166534;font-size:14px;">We have received your complaint and will act on it promptly.</p></td></tr>
  <tr><td style="padding:36px 40px;">
    <p style="margin:0 0 24px;color:#374151;font-size:15px;">Dear <strong>${citizen.name}</strong>,<br/>
    Thank you for reaching out to CityFix. Your complaint has been registered:</p>
    <div style="background:#eff6ff;border:1.5px dashed #3b82f6;border-radius:10px;padding:16px 24px;margin-bottom:28px;text-align:center;">
      <p style="margin:0 0 4px;font-size:12px;color:#6b7280;text-transform:uppercase;font-weight:600;">Your Complaint ID</p>
      <p style="margin:0;font-size:28px;font-weight:800;color:#1d4ed8;letter-spacing:2px;">${complaint.complaintId}</p>
    </div>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:28px;">
      <tr><td style="padding:12px 16px;background:#f9fafb;border-bottom:1px solid #e5e7eb;">
        <span style="font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;">📋 Title</span><br/>
        <span style="font-size:15px;color:#111827;font-weight:600;">${complaint.title}</span></td></tr>
      <tr><td style="padding:12px 16px;background:#fff;border-bottom:1px solid #e5e7eb;">
        <span style="font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;">🏢 Department</span><br/>
        <span style="font-size:15px;color:#111827;">${complaint.department}</span></td></tr>
      <tr><td style="padding:12px 16px;background:#f9fafb;border-bottom:1px solid #e5e7eb;">
        <span style="font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;">⚠️ Severity</span><br/>
        <span style="display:inline-block;margin-top:6px;padding:3px 12px;border-radius:20px;font-size:13px;font-weight:700;color:#fff;background:${severityColor};">
          ${complaint.severity.charAt(0).toUpperCase()+complaint.severity.slice(1)}</span></td></tr>
      <tr><td style="padding:12px 16px;background:#fff;border-bottom:1px solid #e5e7eb;">
        <span style="font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;">📍 Location</span><br/>
        <span style="font-size:15px;color:#111827;">${complaint.location?.address || "—"}</span></td></tr>
      <tr><td style="padding:12px 16px;background:#f9fafb;">
        <span style="font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;">🕐 Submitted At</span><br/>
        <span style="font-size:15px;color:#111827;">${submittedAt}</span></td></tr>
    </table>
    <p style="margin:0;font-size:14px;color:#6b7280;text-align:center;">Use complaint ID <strong style="color:#1d4ed8;">${complaint.complaintId}</strong> to track your complaint.</p>
  </td></tr>
  <tr><td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 40px;text-align:center;">
    <p style="margin:0;font-size:12px;color:#9ca3af;">CityFix – Automated notification. Do not reply.</p></td></tr>
  </table></td></tr></table></body></html>`;
}

function buildResolvedEmail(citizen, complaint) {
  const resolvedAt = complaint.resolvedAt
    ? new Date(complaint.resolvedAt).toLocaleString("en-IN", { day:"2-digit", month:"long", year:"numeric", hour:"2-digit", minute:"2-digit" })
    : new Date().toLocaleString("en-IN", { day:"2-digit", month:"long", year:"numeric" });

  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 20px;"><tr><td align="center">
  <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);max-width:600px;width:100%;">
  <tr><td style="background:linear-gradient(135deg,#1e3a5f,#2563eb);padding:36px 40px;text-align:center;">
    <span style="font-size:24px;font-weight:700;color:#fff;">City<span style="color:#93c5fd;">Fix</span></span></td></tr>
  <tr><td style="background:#f0fdf4;border-bottom:2px solid #bbf7d0;padding:20px 40px;text-align:center;">
    <span style="font-size:32px;">✅</span>
    <h2 style="margin:8px 0 4px;color:#15803d;font-size:20px;font-weight:700;">Complaint Resolved!</h2>
    <p style="margin:0;color:#166534;font-size:14px;">Your complaint has been successfully resolved.</p></td></tr>
  <tr><td style="padding:36px 40px;">
    <p style="margin:0 0 20px;color:#374151;font-size:15px;">Dear <strong>${citizen.name}</strong>,</p>
    <p style="margin:0 0 20px;color:#374151;font-size:14px;line-height:1.7;">
      We are pleased to inform you that your complaint <strong style="color:#2563eb;">${complaint.complaintId}</strong> has been resolved.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin-bottom:24px;">
      <tr><td style="padding:7px 0;font-size:13px;color:#6b7280;width:130px;">Complaint ID</td><td style="font-size:14px;font-weight:700;color:#2563eb;">${complaint.complaintId}</td></tr>
      <tr><td style="padding:7px 0;font-size:13px;color:#6b7280;">Title</td><td style="font-size:14px;color:#111827;">${complaint.title}</td></tr>
      <tr><td style="padding:7px 0;font-size:13px;color:#6b7280;">Department</td><td style="font-size:14px;color:#111827;">${complaint.department}</td></tr>
      <tr><td style="padding:7px 0;font-size:13px;color:#6b7280;">Resolved On</td><td style="font-size:14px;color:#111827;">${resolvedAt}</td></tr>
    </table>
    <p style="font-size:13px;color:#6b7280;text-align:center;">Thank you for using CityFix to report civic issues.</p>
  </td></tr>
  <tr><td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 40px;text-align:center;">
    <p style="margin:0;font-size:12px;color:#9ca3af;">CityFix – Automated notification. Do not reply.</p></td></tr>
  </table></td></tr></table></body></html>`;
}

async function sendMail(to, subject, html) {
  try {
    if (!to || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) return;
    await transporter.sendMail({ from: `"CityFix" <${process.env.EMAIL_USER}>`, to, subject, html });
    console.log(`Email sent to ${to}: ${subject}`);
  } catch (e) {
    console.error("Email failed (non-fatal):", e.message);
  }
}

// ─────────────────────────────────────────────
// POST /api/create  —  Submit a complaint
// NEW: accepts isAnonymous flag
// ─────────────────────────────────────────────
router.post("/create", upload.single("evidence"), async (req, res) => {
  try {
    const { title, description, location, department, severity, citizenId, isAnonymous } = req.body;

    if (!title || !description || !location || !department)
      return res.status(400).json({ message: "Please fill all required fields" });
    if (!citizenId)
      return res.status(400).json({ message: "User not logged in. Please log in and try again." });

    const complaint = new Complaint({
      title,
      description,
      department,
      severity:    severity || "medium",
      citizenId,
      isAnonymous: isAnonymous === "true" || isAnonymous === true,
      location: {
        address: location,
        lat: req.body.lat ? parseFloat(req.body.lat) : undefined,
        lng: req.body.lng ? parseFloat(req.body.lng) : undefined,
      },
      evidencePaths: req.file ? [req.file.path] : [],  // Cloudinary URL
      status: "pending",
    });

    await complaint.save();

    await Department.findOneAndUpdate(
      { name: department },
      { $inc: { totalComplaints: 1, pendingComplaints: 1 } }
    );

    // Confirmation email
    try {
      const citizen = await User.findById(citizenId);
      if (citizen?.email) {
        await sendMail(
          citizen.email,
          `✅ Complaint Submitted – ${complaint.complaintId} | CityFix`,
          buildConfirmationEmail(citizen, complaint)
        );
      }
    } catch (e) { console.error("Confirmation email failed:", e.message); }

    return res.status(201).json({
      message:     "Complaint submitted successfully",
      complaintId: complaint.complaintId,
      _id:         complaint._id,
      complaint,
    });
  } catch (err) {
    console.error("Error creating complaint:", err);
    return res.status(500).json({ message: "Error creating complaint", error: err.message });
  }
});

// ─────────────────────────────────────────────
// GET /api/mycomplaints?userId=<id>
// ─────────────────────────────────────────────
router.get("/mycomplaints", async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.json([]);
    const complaints = await Complaint
      .find({ citizenId: userId })
      .populate("officerId", "name designation departmentName phone email")
      .sort({ createdAt: -1 });
    // Citizen fetching their own list — show full data (viewerIsOwner=true)
    return res.json(complaints.map(c => stripAnonymous(c, true)));
  } catch (err) {
    return res.status(500).json({ message: "Error fetching complaints", error: err.message });
  }
});

// ─────────────────────────────────────────────
// GET /api/complaint/:id  — by complaintId or _id
// ─────────────────────────────────────────────
router.get("/complaint/:id", async (req, res) => {
  try {
    const { id } = req.params;
    // viewer=admin  → full data (admin portal calls this)
    // userId=<id>   → check if this is the owner; if so, full data
    const viewerIsAdmin = req.query.viewer === "admin";
    const viewerUserId  = req.query.userId || null;

    let complaint = await Complaint
      .findOne({ complaintId: id.toUpperCase() })
      .populate("officerId", "name designation departmentName phone email")
      .populate("citizenId", "name email phone");
    if (!complaint) {
      complaint = await Complaint
        .findById(id)
        .populate("officerId", "name designation departmentName phone email")
        .populate("citizenId", "name email phone")
        .catch(() => null);
    }
    if (!complaint) return res.status(404).json({ message: "Complaint not found" });

    // Determine if the requester is the complaint owner
    const ownerId       = complaint.citizenId?._id?.toString() || complaint.citizenId?.toString();
    const viewerIsOwner = viewerUserId && ownerId && viewerUserId === ownerId;

    // Admin always sees everything; owner always sees their own data; everyone else gets stripped
    const shouldStrip = !viewerIsAdmin && !viewerIsOwner;
    return res.json(stripAnonymous(complaint, !shouldStrip));
  } catch (err) {
    return res.status(500).json({ message: "Error fetching complaint", error: err.message });
  }
});

// ─────────────────────────────────────────────
// PATCH /api/complaint/:id/assign  —  Admin assigns officer
// ─────────────────────────────────────────────
router.patch("/complaint/:id/assign", async (req, res) => {
  try {
    const { officerId } = req.body;
    const officer = await Officer.findById(officerId);
    if (!officer) return res.status(404).json({ message: "Officer not found" });

    const complaint = await Complaint.findByIdAndUpdate(
      req.params.id,
      { status: "assigned", officerId: officer._id, assignedAt: new Date() },
      { new: true }
    ).populate("officerId", "name designation departmentName phone email");

    if (!complaint) return res.status(404).json({ message: "Complaint not found" });

    await Department.findOneAndUpdate({ name: complaint.department }, { $inc: { pendingComplaints: -1 } });
    await Officer.findByIdAndUpdate(officer._id, { $inc: { casesHandled: 1 } });
    res.json({ message: "Officer assigned successfully", complaint });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────
// PATCH /api/complaint/:id/status  —  Officer updates to in_progress
// (resolve is now handled by /resolve with AI check)
// ─────────────────────────────────────────────
router.patch("/complaint/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    if (!["in_progress", "rejected"].includes(status))
      return res.status(400).json({ message: "Use /resolve to mark resolved. Only in_progress and rejected allowed here." });

    const complaint = await Complaint.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!complaint) return res.status(404).json({ message: "Complaint not found" });

    if (status === "rejected") {
      await Department.findOneAndUpdate({ name: complaint.department }, { $inc: { pendingComplaints: -1 } });
    }
    res.json({ message: "Status updated successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────
// PATCH /api/complaint/:id/withdraw  —  Citizen withdraws
// ─────────────────────────────────────────────
router.patch("/complaint/:id/withdraw", async (req, res) => {
  try {
    const complaint = await Complaint.findByIdAndUpdate(req.params.id, { status: "rejected" }, { new: true });
    if (!complaint) return res.status(404).json({ message: "Complaint not found" });
    await Department.findOneAndUpdate({ name: complaint.department }, { $inc: { pendingComplaints: -1 } });
    res.json({ message: "Complaint withdrawn" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────
// PATCH /api/complaint/:id/reject-assignment
// ─────────────────────────────────────────────
router.patch("/complaint/:id/reject-assignment", async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) return res.status(404).json({ message: "Complaint not found" });

    if (complaint.officerId) {
      await Officer.findByIdAndUpdate(complaint.officerId, { $inc: { casesHandled: -1 } });
    }
    complaint.officerId  = null;
    complaint.status     = "pending";
    complaint.assignedAt = null;
    await complaint.save();
    res.json({ message: "Assignment declined. Complaint returned to queue." });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────
// PATCH /api/complaint/:id/officer-reject
// ─────────────────────────────────────────────
router.patch("/complaint/:id/officer-reject", async (req, res) => {
  try {
    const { rejectionReason } = req.body;
    if (!rejectionReason?.trim())
      return res.status(400).json({ message: "A rejection reason is required." });

    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) return res.status(404).json({ message: "Complaint not found" });

    complaint.status          = "rejected";
    complaint.rejectionReason = rejectionReason.trim();
    await complaint.save();
    await Department.findOneAndUpdate({ name: complaint.department }, { $inc: { pendingComplaints: -1 } });
    res.json({ message: "Complaint rejected.", complaint });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────
// PATCH /api/complaint/:id/resolve   ← MAIN NEW ENDPOINT
// Officer submits resolution evidence — AI verifies before/after
// If score ≥ 70: auto-resolve + email
// If score < 70: mark resolved but flag for admin manual review
// ─────────────────────────────────────────────
router.patch("/complaint/:id/resolve", upload.single("evidence"), async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) return res.status(404).json({ message: "Complaint not found" });

    // Require resolution photo
    if (!req.file) {
      return res.status(400).json({ message: "Resolution evidence photo is required to close a complaint." });
    }

    // Save resolution evidence (Cloudinary URL)
    complaint.resolutionEvidencePaths = complaint.resolutionEvidencePaths || [];
    complaint.resolutionEvidencePaths.push(req.file.path);

    // Run AI verification if citizen submitted original evidence
    const beforeEvidence = complaint.evidencePaths?.[0] || null;  // Cloudinary URL
    let aiResult = { score: null, passed: false, summary: "No citizen evidence to compare against." };

    if (beforeEvidence) {
      console.log(`Running AI verification: before=${beforeEvidence} after=${req.file.path}`);
      aiResult = await verifyResolutionWithAI(beforeEvidence, req.file.path);
      console.log(`AI result: score=${aiResult.score}, passed=${aiResult.passed}`);
    } else {
      // No before photo — flag for admin review with a note
      aiResult = { score: null, passed: false, summary: "No original citizen evidence uploaded; admin review required." };
    }

    complaint.aiVerification = {
      matchScore: aiResult.score,
      passed:     aiResult.passed,
      summary:    aiResult.summary,
      checkedAt:  new Date(),
      adminReviewed: false,
      adminAction:   null,
    };

    if (aiResult.passed) {
      // Auto-resolve
      complaint.status     = "resolved";
      complaint.resolvedAt = new Date();

      await complaint.save();

      // Department + officer counters
      await Department.findOneAndUpdate(
        { name: complaint.department },
        { $inc: { resolvedComplaints: 1, pendingComplaints: -1 } }
      );
      if (complaint.officerId) {
        await Officer.findByIdAndUpdate(complaint.officerId, { $inc: { casesResolved: 1 } });
      }

      // Send resolved email to citizen
      const citizen = await User.findById(complaint.citizenId);
      if (citizen?.email) {
        await sendMail(
          citizen.email,
          `✅ Complaint Resolved – ${complaint.complaintId} | CityFix`,
          buildResolvedEmail(citizen, complaint)
        );
      }

      return res.json({
        message:   "Complaint resolved successfully. AI verification passed.",
        aiScore:   aiResult.score,
        aiPassed:  true,
        complaint,
      });

    } else {
      // AI score < 70 — keep status as in_progress and flag for admin review
      complaint.status     = "in_progress";
      complaint.resolvedAt = null;
      await complaint.save();

      return res.json({
        message:        "Evidence submitted. AI verification score was low — complaint remains in progress, flagged for admin review.",
        aiScore:        aiResult.score,
        aiPassed:       false,
        needsReview:    true,
        summary:        aiResult.summary,
        complaint,
      });
    }

  } catch (err) {
    console.error("Resolve error:", err);
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────
// POST /api/complaint/:id/admin-review
// Admin reviews a flagged complaint (AI failed)
// action: "approve" | "reassign"
// ─────────────────────────────────────────────
router.post("/complaint/:id/admin-review", async (req, res) => {
  try {
    const { action } = req.body; // "approve" | "reassign"
    if (!["approve", "reassign"].includes(action))
      return res.status(400).json({ message: "action must be 'approve' or 'reassign'" });

    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) return res.status(404).json({ message: "Complaint not found" });

    complaint.aiVerification.adminReviewed = true;
    complaint.aiVerification.adminAction   = action === "approve" ? "approved" : "reassigned";
    complaint.markModified("aiVerification");

    if (action === "approve") {
      // Admin approves — complaint stays resolved, send email now
      complaint.status     = "resolved";
      complaint.resolvedAt = complaint.resolvedAt || new Date();
      await complaint.save();

      // Department + officer counters (only if not already incremented)
      await Department.findOneAndUpdate({ name: complaint.department }, { $inc: { resolvedComplaints: 1, pendingComplaints: -1 } });
      if (complaint.officerId) {
        await Officer.findByIdAndUpdate(complaint.officerId, { $inc: { casesResolved: 1 } });
      }

      const citizen = await User.findById(complaint.citizenId);
      if (citizen?.email) {
        await sendMail(
          citizen.email,
          `✅ Complaint Resolved – ${complaint.complaintId} | CityFix`,
          buildResolvedEmail(citizen, complaint)
        );
      }
      return res.json({ message: "Complaint approved and resolved by admin.", complaint });

    } else {
      // Reassign — send back to in_progress, clear resolution evidence + AI data
      complaint.status                   = "in_progress";
      complaint.resolvedAt               = null;
      complaint.resolutionEvidencePaths  = [];
      complaint.aiVerification           = { matchScore: null, passed: null, summary: "", checkedAt: null, adminReviewed: false, adminAction: null };
      await complaint.save();
      return res.json({ message: "Complaint reassigned to officer for re-resolution.", complaint });
    }

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────
// POST /api/complaint/:id/comment
// ─────────────────────────────────────────────
router.post("/complaint/:id/comment", async (req, res) => {
  try {
    const { author, text, role } = req.body;
    if (!text?.trim()) return res.status(400).json({ message: "Comment text is required." });

    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) return res.status(404).json({ message: "Complaint not found" });

    const comment = { author: author || "Unknown", role: role || "officer", text: text.trim(), createdAt: new Date() };
    complaint.comments.push(comment);
    await complaint.save();
    res.json({ message: "Comment added.", comment });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
