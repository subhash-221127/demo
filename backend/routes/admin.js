// routes/admin.js
const express    = require("express");
const router     = express.Router();
const nodemailer = require("nodemailer");
const Complaint  = require("../models/Complaint");
const User       = require("../models/User");
const Officer    = require("../models/Officer");
const Department = require("../models/Department");

// Nodemailer transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
});

// Safe send helper (non-fatal)
async function sendEmail(to, subject, html) {
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

// Email: Assigned
function buildAssignedEmail(citizen, complaint, officer) {
  const assignedAt = new Date(complaint.assignedAt || Date.now()).toLocaleString("en-IN", {
    day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
  return [
    "<html><body style='font-family:Arial,sans-serif;background:#f4f6f9;margin:0;padding:40px 20px;'>",
    "<div style='max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);'>",
    "<div style='background:linear-gradient(135deg,#1e3a5f,#2563eb);padding:36px 40px;text-align:center;'>",
    "<span style='font-size:24px;font-weight:700;color:#fff;'>City<span style='color:#93c5fd;'>Fix</span></span></div>",
    "<div style='background:#eff6ff;border-bottom:2px solid #bfdbfe;padding:20px 40px;text-align:center;'>",
    "<div style='font-size:32px;'>&#128110;</div>",
    "<h2 style='color:#1d4ed8;font-size:20px;margin:8px 0 4px;'>Officer Assigned to Your Complaint</h2>",
    "<p style='color:#1e40af;font-size:14px;margin:0;'>Your complaint is now being handled.</p></div>",
    "<div style='padding:36px 40px;'>",
    "<p style='color:#374151;font-size:15px;'>Dear <strong>" + citizen.name + "</strong>,<br/>",
    "Complaint <strong style='color:#1d4ed8;'>" + complaint.complaintId + "</strong> has been assigned to an officer.</p>",
    "<div style='background:#eff6ff;border:1.5px dashed #3b82f6;border-radius:10px;padding:14px 24px;margin-bottom:24px;text-align:center;'>",
    "<p style='margin:0 0 4px;font-size:12px;color:#6b7280;text-transform:uppercase;font-weight:600;'>Complaint ID</p>",
    "<p style='margin:0;font-size:24px;font-weight:800;color:#1d4ed8;letter-spacing:2px;'>" + complaint.complaintId + "</p>",
    "<p style='margin:4px 0 0;font-size:13px;color:#6b7280;'>" + complaint.title + "</p></div>",
    "<div style='background:#f0fdf4;border:1.5px solid #86efac;border-radius:12px;padding:20px 24px;margin-bottom:24px;'>",
    "<p style='margin:0 0 12px;font-size:14px;font-weight:700;color:#15803d;'>Assigned Officer</p>",
    "<table cellpadding='0' cellspacing='0' width='100%'>",
    "<tr><td style='padding:5px 0;font-size:13px;color:#6b7280;width:120px;'>Name</td><td style='font-size:14px;color:#111827;font-weight:600;'>" + officer.name + "</td></tr>",
    "<tr><td style='padding:5px 0;font-size:13px;color:#6b7280;'>Designation</td><td style='font-size:14px;color:#111827;'>" + officer.designation + "</td></tr>",
    "<tr><td style='padding:5px 0;font-size:13px;color:#6b7280;'>Department</td><td style='font-size:14px;color:#111827;'>" + officer.departmentName + "</td></tr>",
    "<tr><td style='padding:5px 0;font-size:13px;color:#6b7280;'>Officer ID</td><td style='font-size:14px;color:#111827;'>" + officer.officerId + "</td></tr>",
    "<tr><td style='padding:5px 0;font-size:13px;color:#6b7280;'>Assigned On</td><td style='font-size:14px;color:#111827;'>" + assignedAt + "</td></tr>",
    "</table></div>",
    "<p style='font-size:13px;color:#6b7280;text-align:center;'>Track your complaint using ID <strong style='color:#1d4ed8;'>" + complaint.complaintId + "</strong> on the CityFix portal.</p>",
    "</div>",
    "<div style='background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 40px;text-align:center;'>",
    "<p style='margin:0;font-size:12px;color:#9ca3af;'>CityFix - Automated notification. Do not reply.</p></div>",
    "</div></body></html>"
  ].join("");
}

// Email: Rejected
function buildRejectedEmail(citizen, complaint) {
  return [
    "<html><body style='font-family:Arial,sans-serif;background:#f4f6f9;margin:0;padding:40px 20px;'>",
    "<div style='max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);'>",
    "<div style='background:linear-gradient(135deg,#1e3a5f,#2563eb);padding:36px 40px;text-align:center;'>",
    "<span style='font-size:24px;font-weight:700;color:#fff;'>City<span style='color:#93c5fd;'>Fix</span></span></div>",
    "<div style='background:#fef2f2;border-bottom:2px solid #fecaca;padding:20px 40px;text-align:center;'>",
    "<div style='font-size:32px;'>&#10060;</div>",
    "<h2 style='color:#dc2626;font-size:20px;margin:8px 0 4px;'>Complaint Could Not Be Processed</h2>",
    "<p style='color:#b91c1c;font-size:14px;margin:0;'>Your complaint has been reviewed and rejected.</p></div>",
    "<div style='padding:36px 40px;'>",
    "<p style='color:#374151;font-size:15px;'>Dear <strong>" + citizen.name + "</strong>,<br/>",
    "After reviewing complaint <strong style='color:#dc2626;'>" + complaint.complaintId + "</strong>, our admin team was unable to process it.</p>",
    "<div style='background:#eff6ff;border:1.5px dashed #3b82f6;border-radius:10px;padding:14px 24px;margin-bottom:24px;text-align:center;'>",
    "<p style='margin:0 0 4px;font-size:12px;color:#6b7280;text-transform:uppercase;font-weight:600;'>Complaint ID</p>",
    "<p style='margin:0;font-size:24px;font-weight:800;color:#1d4ed8;letter-spacing:2px;'>" + complaint.complaintId + "</p>",
    "<p style='margin:4px 0 0;font-size:13px;color:#6b7280;'>" + complaint.title + "</p></div>",
    "<div style='background:#fef2f2;border-left:4px solid #ef4444;border-radius:0 8px 8px 0;padding:16px 20px;margin-bottom:24px;'>",
    "<p style='margin:0 0 8px;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;'>Reason for Rejection</p>",
    "<p style='margin:0;color:#7f1d1d;font-size:15px;line-height:1.7;'>" + (complaint.rejectionReason || "No specific reason provided.") + "</p></div>",
    "<div style='background:#fefce8;border:1.5px solid #fde68a;border-radius:10px;padding:16px 20px;margin-bottom:24px;'>",
    "<p style='margin:0 0 8px;font-size:13px;font-weight:700;color:#92400e;'>What can you do?</p>",
    "<p style='margin:0;font-size:13px;color:#78350f;line-height:1.7;'>",
    "If you believe this is a mistake, please re-submit your complaint with clearer information on the CityFix portal.</p></div>",
    "</div>",
    "<div style='background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 40px;text-align:center;'>",
    "<p style='margin:0;font-size:12px;color:#9ca3af;'>CityFix - Automated notification. Do not reply.</p></div>",
    "</div></body></html>"
  ].join("");
}



// ─────────────────────────────────────────────────────────────────
// Helper — wipe citizen identity from a complaint if anonymous
// Admin explicitly cannot see citizen details if isAnonymous=true
// ─────────────────────────────────────────────────────────────────
function stripAnonymous(complaint) {
  if (!complaint) return complaint;
  const c = typeof complaint.toObject === 'function' ? complaint.toObject() : { ...complaint };
  if (!c.isAnonymous) return c;
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

// ─────────────────────────────────────────────────────────────────
// GET /api/admin/stats
// ─────────────────────────────────────────────────────────────────
router.get("/admin/stats", async (_req, res) => {
  try {
    const [total, pending, inProgress, resolved, rejected, citizens, officers] = await Promise.all([
      Complaint.countDocuments(),
      Complaint.countDocuments({ status: "pending" }),
      Complaint.countDocuments({ status: { $in: ["assigned", "in_progress"] } }),
      Complaint.countDocuments({ status: "resolved" }),
      Complaint.countDocuments({ status: "rejected" }),
      User.countDocuments({ role: "citizen" }),
      Officer.countDocuments(),
    ]);
    res.json({ total, pending, inProgress, resolved, rejected, citizens, officers });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/admin/complaints — all, newest first
// ─────────────────────────────────────────────────────────────────
router.get("/admin/complaints", async (_req, res) => {
  try {
    const complaints = await Complaint.find()
      .populate("officerId", "name designation departmentName officerId")
      .populate("citizenId", "name email phone")
      .sort({ createdAt: -1 });
    res.json(complaints.map(c => stripAnonymous(c)));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/admin/complaints/today
// ─────────────────────────────────────────────────────────────────
router.get("/admin/complaints/today", async (_req, res) => {
  try {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end   = new Date(); end.setHours(23, 59, 59, 999);
    const complaints = await Complaint.find({ createdAt: { $gte: start, $lte: end } })
      .populate("officerId", "name designation departmentName")
      .populate("citizenId", "name email phone")
      .sort({ createdAt: -1 });
    res.json(complaints.map(c => stripAnonymous(c)));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/admin/complaints/:id  (MUST be after /today)
// ─────────────────────────────────────────────────────────────────
router.get("/admin/complaints/:id", async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id)
      .populate("officerId", "name designation departmentName officerId email phone")
      .populate("citizenId", "name email phone");
    if (!complaint) return res.status(404).json({ message: "Complaint not found." });
    res.json(stripAnonymous(complaint));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────
// POST /api/admin/complaints/:id/assign
// Body: { officerId }
// ─────────────────────────────────────────────────────────────────
router.post("/admin/complaints/:id/assign", async (req, res) => {
  try {
    const { officerId } = req.body;
    if (!officerId) return res.status(400).json({ message: "officerId is required." });

    const officer   = await Officer.findById(officerId);
    if (!officer)   return res.status(404).json({ message: "Officer not found." });

    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) return res.status(404).json({ message: "Complaint not found." });

    const alreadyAssigned = complaint.officerId &&
      complaint.officerId.toString() === officerId.toString();

    complaint.officerId  = officer._id;
    complaint.status     = "assigned";
    complaint.assignedAt = new Date();
    await complaint.save();

    if (!alreadyAssigned) {
      await Officer.findByIdAndUpdate(officer._id, { $inc: { casesHandled: 1 } });
    }

    const populated = await Complaint.findById(complaint._id)
      .populate("officerId", "name designation departmentName officerId email phone")
      .populate("citizenId", "name email phone");

    // Send assignment email to citizen
    const citizen = await User.findById(populated.citizenId._id || populated.citizenId);
    if (citizen) {
      await sendEmail(
        citizen.email,
        "Officer Assigned - " + populated.complaintId + " | CityFix",
        buildAssignedEmail(citizen, populated, officer)
      );
    }

    res.json({ message: `Complaint assigned to ${officer.name} successfully.`, complaint: stripAnonymous(populated) });
  } catch (err) {
    res.status(500).json({ message: "Failed to assign officer.", error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────
// PATCH /api/admin/complaints/:id/reject
// Body: { reason } — reason is saved and shown to citizen
// ─────────────────────────────────────────────────────────────────
router.patch("/admin/complaints/:id/reject", async (req, res) => {
  try {
    const { reason } = req.body;

    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) return res.status(404).json({ message: "Complaint not found." });

    if (complaint.status === "rejected") {
      return res.status(400).json({ message: "Complaint is already rejected." });
    }

    complaint.status          = "rejected";
    complaint.rejectionReason = reason ? reason.trim() : "";
    await complaint.save();

    // Send rejection email to citizen
    const citizen = await User.findById(complaint.citizenId);
    if (citizen) {
      await sendEmail(
        citizen.email,
        "Complaint Update - " + complaint.complaintId + " | CityFix",
        buildRejectedEmail(citizen, complaint)
      );
    }

    res.json({ message: "Complaint rejected.", complaint: stripAnonymous(complaint) });
  } catch (err) {
    res.status(500).json({ message: "Failed to reject complaint.", error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────
// DELETE /api/admin/complaints/:id
// Only for resolved or rejected complaints
// ─────────────────────────────────────────────────────────────────
router.delete("/admin/complaints/:id", async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) return res.status(404).json({ message: "Complaint not found." });

    if (!["resolved", "rejected"].includes(complaint.status)) {
      return res.status(400).json({
        message: "Only resolved or rejected complaints can be deleted."
      });
    }

    await Complaint.findByIdAndDelete(req.params.id);
    res.json({ message: "Complaint deleted successfully." });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete complaint.", error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/admin/citizens
// ─────────────────────────────────────────────────────────────────
router.get("/admin/citizens", async (_req, res) => {
  try {
    const citizens = await User.find({ role: "citizen" }).sort({ createdAt: -1 });
    res.json(citizens);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


// ─────────────────────────────────────────────────────────────────
// GET /api/admin/citizens/:id — single citizen with complaint count
// ─────────────────────────────────────────────────────────────────
router.get("/admin/citizens/:id", async (req, res) => {
  try {
    const citizen = await User.findById(req.params.id);
    if (!citizen) return res.status(404).json({ message: "Citizen not found." });
    const complaintCount = await Complaint.countDocuments({ citizenId: req.params.id });
    res.json({ ...citizen.toObject(), complaintCount });
  } catch (err) {
    if (err.name === "CastError") return res.status(400).json({ message: "Invalid citizen ID." });
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/admin/citizens/:id/complaints — all complaints by citizen
// ─────────────────────────────────────────────────────────────────
router.get("/admin/citizens/:id/complaints", async (req, res) => {
  try {
    const complaints = await Complaint.find({ citizenId: req.params.id })
      .populate("officerId", "name designation departmentName")
      .sort({ createdAt: -1 });
    res.json(complaints.map(c => stripAnonymous(c)));
  } catch (err) {
    if (err.name === "CastError") return res.status(400).json({ message: "Invalid citizen ID." });
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────
// DELETE /api/admin/citizens/:id — remove citizen account
// ─────────────────────────────────────────────────────────────────
router.delete("/admin/citizens/:id", async (req, res) => {
  try {
    const citizen = await User.findByIdAndDelete(req.params.id);
    if (!citizen) return res.status(404).json({ message: "Citizen not found." });
    res.json({ message: "Citizen account deleted." });
  } catch (err) {
    if (err.name === "CastError") return res.status(400).json({ message: "Invalid citizen ID." });
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;