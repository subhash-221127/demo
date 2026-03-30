// models/Officer.js
const mongoose = require("mongoose");

const OfficerSchema = new mongoose.Schema(
  {
    officerId: { type: String, required: true, unique: true, trim: true },
    name:      { type: String, required: true, trim: true },
    email:     { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone:     { type: String, required: true, trim: true },
    password:  { type: String, required: true },
    designation: { type: String, required: true, trim: true },

    department:     { type: mongoose.Schema.Types.ObjectId, ref: "Department", required: true },
    departmentName: { type: String, trim: true },

    status: {
      type: String,
      enum: ["Active", "On Leave"],
      default: "Active",
    },
    joinDate: { type: String, required: true },

    level: {
      type: Number,
      enum: [1, 2, 3],
      default: 1,
    }, // 1 = field officer, 2 = senior officer, 3 = department head/director

    casesHandled:  { type: Number, default: 0 },
    casesResolved: { type: Number, default: 0 },

    // ── Hierarchy ─────────────────────────────────────────────
    // supervisorId: the L2 officer who supervises this L1 officer (or L3 supervising L2)
    supervisorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Officer',
      default: null,
    },

    // ── Password Reset / Set Token ────────────────────────────
    // Generated on account creation and on forgot-password
    resetToken:       { type: String,  default: null },
    resetTokenExpiry: { type: Date,    default: null },
    // false = officer has never set their own password yet
    passwordSet:      { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Officer", OfficerSchema);
