// backend/escalation.js
// Escalation Scheduler — runs every 5 minutes
// L1 → L2: complaint not resolved within 5 minutes (assigned_at)
// L2 → L3: escalated complaint still not resolved 5 more minutes later
"use strict";

const mongoose = require("mongoose");
const Complaint = require("./models/Complaint");
const Officer = require("./models/Officer");
const User = require("./models/User");
const nodemailer = require("nodemailer");

// ── Email transporter ─────────────────────────────────────────
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
});

async function sendMail(to, subject, html) {
  try {
    if (!to || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) return;
    await transporter.sendMail({
      from: `"CityFix" <${process.env.EMAIL_USER}>`,
      to, subject, html,
    });
    console.log(`[Escalation] Email → ${to}: ${subject}`);
  } catch (e) {
    console.error("[Escalation] Email failed (non-fatal):", e.message);
  }
}

// ── Email Templates ─────────────────────────────────────────
function buildEscalationCitizenEmail(citizen, complaint, newOfficer, escalationLevel, previousOfficer) {
  const levelLabel = escalationLevel === 2 ? "Senior Officer" : "Department Director/Head";
  const prevName = previousOfficer ? previousOfficer.name : "Previous Officer";
  const prevDesig = previousOfficer ? previousOfficer.designation : "";
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 20px;"><tr><td align="center">
  <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);max-width:600px;width:100%;">
  <tr><td style="background:linear-gradient(135deg,#1e3a5f,#2563eb);padding:36px 40px;text-align:center;">
    <span style="font-size:24px;font-weight:700;color:#fff;">City<span style="color:#93c5fd;">Fix</span></span></td></tr>
  <tr><td style="background:#fff7ed;border-bottom:2px solid #fed7aa;padding:20px 40px;text-align:center;">
    <span style="font-size:32px;">🔺</span>
    <h2 style="margin:8px 0 4px;color:#c2410c;font-size:20px;font-weight:700;">Complaint Escalated – Level ${escalationLevel}</h2>
    <p style="margin:0;color:#9a3412;font-size:14px;">Your complaint has been escalated to a ${levelLabel}.</p></td></tr>
  <tr><td style="padding:36px 40px;">
    <p style="margin:0 0 20px;color:#374151;font-size:15px;">Dear <strong>${citizen.name}</strong>,</p>
    <p style="margin:0 0 20px;color:#374151;font-size:14px;line-height:1.7;">
      Your complaint <strong style="color:#2563eb;">${complaint.complaintId}</strong> was not resolved within the expected time. 
      It has been escalated to a <strong>${levelLabel}</strong> for immediate attention.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin-bottom:24px;">
      <tr><td style="padding:7px 0;font-size:13px;color:#6b7280;width:160px;">Complaint ID</td><td style="font-size:14px;font-weight:700;color:#2563eb;">${complaint.complaintId}</td></tr>
      <tr><td style="padding:7px 0;font-size:13px;color:#6b7280;">Title</td><td style="font-size:14px;color:#111827;">${complaint.title}</td></tr>
      <tr><td style="padding:7px 0;font-size:13px;color:#6b7280;">Department</td><td style="font-size:14px;color:#111827;">${complaint.department}</td></tr>
      <tr><td style="padding:7px 0;font-size:13px;color:#6b7280;">Previously Handled By</td><td style="font-size:14px;color:#7c3aed;font-weight:600;">${prevName}${prevDesig ? ' — ' + prevDesig : ''}</td></tr>
      <tr><td style="padding:7px 0;font-size:13px;color:#6b7280;">Now Handled By</td><td style="font-size:14px;color:#111827;">${newOfficer ? newOfficer.name + ' (' + newOfficer.designation + ')' : '—'}</td></tr>
      <tr><td style="padding:7px 0;font-size:13px;color:#6b7280;">Escalation Level</td><td style="font-size:14px;font-weight:700;color:#c2410c;">Level ${escalationLevel} – ${levelLabel}</td></tr>
    </table>
    <p style="font-size:13px;color:#6b7280;text-align:center;">We apologize for the delay and will resolve this as quickly as possible.</p>
  </td></tr>
  <tr><td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 40px;text-align:center;">
    <p style="margin:0;font-size:12px;color:#9ca3af;">CityFix – Automated notification. Do not reply.</p></td></tr>
  </table></td></tr></table></body></html>`;
}

function buildEscalationOfficerEmail(officer, complaint, escalationLevel, previousOfficer) {
  const prevName = previousOfficer ? previousOfficer.name : "Previous Officer";
  const prevDesig = previousOfficer ? previousOfficer.designation : "";
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 20px;"><tr><td align="center">
  <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);max-width:600px;width:100%;">
  <tr><td style="background:linear-gradient(135deg,#1e3a5f,#2563eb);padding:36px 40px;text-align:center;">
    <span style="font-size:24px;font-weight:700;color:#fff;">City<span style="color:#93c5fd;">Fix</span></span></td></tr>
  <tr><td style="background:#fff7ed;border-bottom:2px solid #fed7aa;padding:20px 40px;text-align:center;">
    <span style="font-size:32px;">⚠️</span>
    <h2 style="margin:8px 0 4px;color:#c2410c;font-size:20px;font-weight:700;">Escalated Complaint Assigned – Action Required</h2>
    <p style="margin:0;color:#9a3412;font-size:14px;">A complaint has been escalated to you as Level ${escalationLevel} Officer.</p></td></tr>
  <tr><td style="padding:36px 40px;">
    <p style="margin:0 0 20px;color:#374151;font-size:15px;">Dear <strong>${officer.name}</strong>,</p>
    <p style="margin:0 0 20px;color:#374151;font-size:14px;line-height:1.7;">
      The following complaint has been escalated to you because the previous officer did not resolve it within the required SLA time.
      Please review and take immediate action.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin-bottom:24px;">
      <tr><td style="padding:7px 0;font-size:13px;color:#6b7280;width:160px;">Complaint ID</td><td style="font-size:14px;font-weight:700;color:#2563eb;">${complaint.complaintId}</td></tr>
      <tr><td style="padding:7px 0;font-size:13px;color:#6b7280;">Title</td><td style="font-size:14px;color:#111827;">${complaint.title}</td></tr>
      <tr><td style="padding:7px 0;font-size:13px;color:#6b7280;">Department</td><td style="font-size:14px;color:#111827;">${complaint.department}</td></tr>
      <tr><td style="padding:7px 0;font-size:13px;color:#6b7280;">Severity</td><td style="font-size:14px;color:#111827;text-transform:capitalize;">${complaint.severity}</td></tr>
      <tr><td style="padding:7px 0;font-size:13px;color:#6b7280;">Previously Handled By</td><td style="font-size:14px;color:#7c3aed;font-weight:600;">${prevName}${prevDesig ? ' — ' + prevDesig : ''}</td></tr>
      <tr><td style="padding:7px 0;font-size:13px;color:#6b7280;">Your Role</td><td style="font-size:14px;font-weight:700;color:#c2410c;">Level ${escalationLevel} Officer – ${officer.designation}</td></tr>
    </table>
    <div style="background:#fef3c7;border:1.5px solid #fde68a;border-radius:10px;padding:16px 20px;margin-bottom:16px;">
      <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#92400e;">Action Required</p>
      <p style="margin:0;font-size:13px;color:#78350f;line-height:1.7;">Log in to CityFix and review this complaint immediately from your <strong>Escalated Complaints</strong> tab.</p>
    </div>
  </td></tr>
  <tr><td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 40px;text-align:center;">
    <p style="margin:0;font-size:12px;color:#9ca3af;">CityFix – Automated notification. Do not reply.</p></td></tr>
  </table></td></tr></table></body></html>`;
}

// ── Find the best supervisor officer to escalate to ──────────────
// Strategy:
//   1. If the assigned L1 officer has a supervisorId, escalate to that specific L2 supervisor.
//   2. If no supervisor, find the L2 officer in the same department with fewest active cases.
//   3. Equal split: distribute evenly.
async function findL2ForComplaint(complaint) {
  // First, try to get supervisor of the originally assigned L1 officer
  if (complaint.officerId) {
    const l1Officer = await Officer.findById(complaint.officerId);
    if (l1Officer && l1Officer.supervisorId) {
      const supervisor = await Officer.findOne({
        _id: l1Officer.supervisorId,
        level: 2,
        status: "Active",
      });
      if (supervisor) {
        console.log(`[Escalation] Using supervisor hierarchy: L1=${l1Officer.name} → L2=${supervisor.name}`);
        return supervisor;
      }
    }
  }

  // Fallback: find L2 with fewest active assigned complaints in this dept
  const l2Officers = await Officer.find({
    departmentName: complaint.department,
    level: 2,
    status: "Active",
  });

  if (!l2Officers.length) return null;

  // Count active cases per L2 officer
  const counts = await Promise.all(l2Officers.map(async (o) => {
    const count = await Complaint.countDocuments({
      level2OfficerId: o._id,
      status: { $in: ["assigned", "in_progress"] },
    });
    return { officer: o, count };
  }));

  // Sort by fewest active cases (equal distribution)
  counts.sort((a, b) => a.count - b.count);
  console.log(`[Escalation] No supervisor set for L1 officer — using least-loaded L2: ${counts[0].officer.name} (${counts[0].count} active)`);
  return counts[0].officer;
}

async function findL3ForComplaint(complaint) {
  // First, check if the L2 officer has a supervisor (L3)
  if (complaint.level2OfficerId) {
    const l2Officer = await Officer.findById(complaint.level2OfficerId);
    if (l2Officer && l2Officer.supervisorId) {
      const supervisor = await Officer.findOne({
        _id: l2Officer.supervisorId,
        level: 3,
        status: "Active",
      });
      if (supervisor) {
        console.log(`[Escalation] Using supervisor hierarchy: L2=${l2Officer.name} → L3=${supervisor.name}`);
        return supervisor;
      }
    }
  }

  // Fallback: find L3 officer in same department with fewest active L3 cases
  const l3Officers = await Officer.find({
    departmentName: complaint.department,
    level: 3,
    status: "Active",
  });

  if (!l3Officers.length) return null;

  const counts = await Promise.all(l3Officers.map(async (o) => {
    const count = await Complaint.countDocuments({
      level3OfficerId: o._id,
      status: { $in: ["assigned", "in_progress"] },
    });
    return { officer: o, count };
  }));

  counts.sort((a, b) => a.count - b.count);
  console.log(`[Escalation] No supervisor set for L2 officer — using least-loaded L3: ${counts[0].officer.name} (${counts[0].count} active)`);
  return counts[0].officer;
}

// ── Main escalation check ─────────────────────────────────────
async function runEscalationCheck() {
  try {
    const now = new Date();

    // ── L1 → L2: assigned_at > 5 minutes ──────────────────────
    const L1_SLA_MS = 2 * 24 * 60 * 60 * 1000; // 24 hours
    const l1Cutoff = new Date(now - L1_SLA_MS);

    const l1OverdueComplaints = await Complaint.find({
      escalationLevel: 1,
      status: { $in: ["assigned", "in_progress"] },
      assignedAt: { $lt: l1Cutoff, $ne: null },
    }).populate("citizenId", "name email").populate("officerId", "name designation email phone");

    let l1EscalatedCount = 0;
    for (const complaint of l1OverdueComplaints) {
      const l2Officer = await findL2ForComplaint(complaint);

      if (!l2Officer) {
        console.log(`[Escalation] No L2 officer found for dept: ${complaint.department}. Skipping.`);
        continue;
      }

      // Capture previous L1 officer details for history
      const prevOfficer = complaint.officerId && typeof complaint.officerId === 'object'
        ? complaint.officerId
        : null;

      const prevOfficerId = prevOfficer ? prevOfficer._id : complaint.officerId;
      const prevOfficerName = prevOfficer ? prevOfficer.name : "L1 Officer";
      const prevOfficerDesig = prevOfficer ? prevOfficer.designation : "";

      // Update complaint  — also update officerId to the new L2 officer
      complaint.escalationLevel = 2;
      complaint.level2OfficerId = l2Officer._id;
      complaint.officerId = l2Officer._id;   // ← update main officer field
      complaint.escalatedAt = now;
      complaint.escalationHistory.push({
        level: 2,
        officerId: l2Officer._id,
        officerName: l2Officer.name,
        assignedAt: now,
        reason: `Auto-escalated: L1 officer SLA exceeded (5 minutes). Previously handled by ${prevOfficerName}${prevOfficerDesig ? ' — ' + prevOfficerDesig : ''}.`,
      });
      await complaint.save();

      l1EscalatedCount++;
      console.log(`[Escalation] L1→L2: ${complaint.complaintId} → ${l2Officer.name} (was: ${prevOfficerName})`);

      // Notify citizen
      const citizen = complaint.citizenId;
      if (citizen?.email) {
        await sendMail(
          citizen.email,
          `🔺 Complaint Escalated – ${complaint.complaintId} | CityFix`,
          buildEscalationCitizenEmail(citizen, complaint, l2Officer, 2, prevOfficer)
        );
      }

      // Notify L2 officer
      if (l2Officer.email) {
        await sendMail(
          l2Officer.email,
          `⚠️ Escalated Complaint Assigned – ${complaint.complaintId} | CityFix`,
          buildEscalationOfficerEmail(l2Officer, complaint, 2, prevOfficer)
        );
      }
    }

    // ── L2 → L3: escalatedAt > 5 minutes, not yet at L3 ──────
    const L2_SLA_MS =  2 * 24 * 60 * 60 * 1000; // 2 minutes
    const l2Cutoff = new Date(now - L2_SLA_MS);

    const l2OverdueComplaints = await Complaint.find({
      escalationLevel: 2,
      status: { $in: ["assigned", "in_progress"] },
      escalatedAt: { $lt: l2Cutoff, $ne: null },
    }).populate("citizenId", "name email").populate("officerId", "name designation email phone");

    let l2EscalatedCount = 0;
    for (const complaint of l2OverdueComplaints) {
      const l3Officer = await findL3ForComplaint(complaint);

      if (!l3Officer) {
        console.log(`[Escalation] No L3 officer found for dept: ${complaint.department}. Skipping.`);
        continue;
      }

      // Capture previous L2 officer details
      const prevOfficer = complaint.officerId && typeof complaint.officerId === 'object'
        ? complaint.officerId
        : null;

      const prevOfficerName = prevOfficer ? prevOfficer.name : "L2 Officer";
      const prevOfficerDesig = prevOfficer ? prevOfficer.designation : "";

      complaint.escalationLevel = 3;
      complaint.level3OfficerId = l3Officer._id;
      complaint.officerId = l3Officer._id;   // ← update main officer field
      complaint.escalatedToL3At = now;
      complaint.escalationHistory.push({
        level: 3,
        officerId: l3Officer._id,
        officerName: l3Officer.name,
        assignedAt: now,
        reason: `Auto-escalated: L2 officer SLA exceeded (5 minutes after L2 assignment). Previously handled by ${prevOfficerName}${prevOfficerDesig ? ' — ' + prevOfficerDesig : ''}.`,
      });
      await complaint.save();

      l2EscalatedCount++;
      console.log(`[Escalation] L2→L3: ${complaint.complaintId} → ${l3Officer.name} (was: ${prevOfficerName})`);

      // Notify citizen
      const citizen = complaint.citizenId;
      if (citizen?.email) {
        await sendMail(
          citizen.email,
          `🔺 Complaint Escalated to Director – ${complaint.complaintId} | CityFix`,
          buildEscalationCitizenEmail(citizen, complaint, l3Officer, 3, prevOfficer)
        );
      }

      // Notify L3 officer
      if (l3Officer.email) {
        await sendMail(
          l3Officer.email,
          `⚠️ Critical: Escalated Complaint – ${complaint.complaintId} | CityFix`,
          buildEscalationOfficerEmail(l3Officer, complaint, 3, prevOfficer)
        );
      }
    }

    if (l1EscalatedCount > 0 || l2EscalatedCount > 0) {
      console.log(
        `[Escalation] Done — L1→L2: ${l1EscalatedCount}, L2→L3: ${l2EscalatedCount}`
      );
    }

  } catch (err) {
    console.error("[Escalation] Scheduler error:", err.message);
  }
}

// ── Start the scheduler (called from server.js) ───────────────
const INTERVAL_MS = 5 * 60 * 1000; // every 5 minutes

function startEscalationScheduler() {
  console.log("[Escalation] Scheduler started (runs every 5 minutes, SLA: 5 min per level, all departments)");
  // Run once immediately after DB connects, then repeat
  setTimeout(runEscalationCheck, 5000); // 5s delay to let DB connect
  setInterval(runEscalationCheck, INTERVAL_MS);
}

module.exports = { startEscalationScheduler };
