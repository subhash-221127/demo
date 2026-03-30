const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema({
  complaintId: { type: String, unique: true },

  title:       { type: String, required: true, trim: true },
  description: { type: String, required: true },
  department:  { type: String, required: true },

  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['pending', 'assigned', 'in_progress', 'resolved', 'rejected'],
    default: 'pending'
  },

  // Reason given by admin when rejecting — shown to citizen
  rejectionReason: { type: String, default: '' },

  location: {
    address: { type: String, default: '' },
    lat:     { type: Number },
    lng:     { type: Number }
  },

  // ── Evidence ──────────────────────────────────────────────────
  // evidencePaths[0] is ALWAYS the citizen's original "before" evidence
  evidencePaths: [String],

  // Resolution photos uploaded by officer when closing the complaint
  resolutionEvidencePaths: [String],

  // ── Identity Masking ──────────────────────────────────────────
  // When true: officer sees masked citizen contact details
  isAnonymous: { type: Boolean, default: false },

  // ── AI Verification ───────────────────────────────────────────
  // Populated after officer submits resolution evidence
  aiVerification: {
    matchScore:    { type: Number,  default: null },  // 0–100
    passed:        { type: Boolean, default: null },  // true = ≥70
    summary:       { type: String,  default: '' },
    checkedAt:     { type: Date,    default: null },
    // If failed, admin sees it under "needs_review"; can approve or reassign
    adminReviewed: { type: Boolean, default: false },
    adminAction:   { type: String,  enum: ['approved', 'reassigned', null], default: null },
  },

  citizenId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  officerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Officer',
    default: null
  },
  assignedAt:  { type: Date, default: null },
  resolvedAt:  { type: Date, default: null },

  // ── Escalation ─────────────────────────────────────────────────
  // escalationLevel: 1 = L1 officer, 2 = escalated to L2, 3 = escalated to L3
  escalationLevel:   { type: Number, enum: [1, 2, 3], default: 1 },
  escalatedAt:       { type: Date,   default: null },   // when escalated from L1 → L2
  escalatedToL3At:   { type: Date,   default: null },   // when escalated from L2 → L3

  level2OfficerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Officer',
    default: null,
  },
  level3OfficerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Officer',
    default: null,
  },

  // L3 officer's closure explanation (shown to citizen)
  escalationNote: { type: String, default: '' },

  // Full escalation history — one entry per escalation event
  escalationHistory: [
    {
      level:       { type: Number },               // level being escalated TO
      officerId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Officer' },
      officerName: { type: String, default: '' },
      assignedAt:  { type: Date, default: Date.now },
      reason:      { type: String, default: 'Auto-escalated due to SLA breach' },
    }
  ],


  comments: [
    {
      author:    { type: String, default: 'Unknown' },
      role:      { type: String, default: 'officer' }, // 'officer' | 'admin'
      text:      { type: String, required: true },
      createdAt: { type: Date,   default: Date.now },
    }
  ],

}, { timestamps: true });

// Auto-generate complaint ID before first save (Mongoose v9 — no next())
complaintSchema.pre('save', async function () {
  if (!this.complaintId) {
    const count = await mongoose.model('Complaint').countDocuments();
    const year  = new Date().getFullYear();
    this.complaintId = `CMP-${year}-${String(count + 1).padStart(4, '0')}`;
  }
});

module.exports = mongoose.model('Complaint', complaintSchema);