// routes/departments.js
const express    = require("express");
const router     = express.Router();
const Department = require("../models/Department");
const Complaint  = require("../models/Complaint");
const Officer    = require("../models/Officer");

// Helper: build a filter that matches complaints for a department
// Tries exact name first, falls back to first-keyword regex for legacy complaints
// Known legacy name mappings: DB name → old citizen category names
const LEGACY_MAP = {
  "Roads & Infrastructure": ["Roads", "Potholes", "Infrastructure"],
  "Water Supply":           ["Water", "Sewage"],
  "Electricity":            ["Electricity", "Lighting"],
  "Sanitation":             ["Sanitation", "Garbage"],
  "Parks & Recreation":     ["Parks", "Recreation"],
  "Public Safety":          ["Safety", "Public Safety", "Noise"],
};

function buildDeptFilter(deptName) {
  const keywords = LEGACY_MAP[deptName];
  if (keywords) {
    // Match any complaint whose department contains ANY of the keywords
    const pattern = keywords.join("|");
    return { department: new RegExp(pattern, "i") };
  }
  // Unknown department: exact match only
  return { department: deptName };
}

// GET /api/departments — ALL departments with live computed stats
router.get("/departments", async (_req, res) => {
  try {
    const departments = await Department.find({}).sort({ name: 1 });

    const enriched = await Promise.all(departments.map(async function(dept) {
      try {
        const deptFilter = buildDeptFilter(dept.name);

        const results = await Promise.all([
          Complaint.countDocuments(deptFilter),
          Complaint.countDocuments(Object.assign({}, deptFilter, { status: "resolved" })),
          Complaint.countDocuments(Object.assign({}, deptFilter, { status: "pending" })),
          Complaint.countDocuments(Object.assign({}, deptFilter, { status: { $in: ["assigned", "in_progress"] } })),
          Officer.countDocuments({ departmentName: dept.name }),
          Officer.countDocuments({ departmentName: dept.name, status: "Active" }),
        ]);

        return Object.assign({}, dept.toObject(), {
          totalComplaints:      results[0],
          resolvedComplaints:   results[1],
          pendingComplaints:    results[2],
          inProgressComplaints: results[3],
          totalOfficers:        results[4],
          activeOfficers:       results[5],
        });
      } catch (e) {
        console.error("Stats error for dept:", dept.name, e.message);
        return Object.assign({}, dept.toObject(), {
          totalComplaints: 0, resolvedComplaints: 0, pendingComplaints: 0,
          inProgressComplaints: 0, totalOfficers: 0, activeOfficers: 0,
        });
      }
    }));

    res.json(enriched);
  } catch (err) {
    console.error("GET /departments error:", err.message);
    res.status(500).json({ message: "Failed to fetch departments", error: err.message });
  }
});

// GET /api/departments/:id — single department with live stats
router.get("/departments/:id", async (req, res) => {
  try {
    const dept = await Department.findById(req.params.id);
    if (!dept) return res.status(404).json({ message: "Department not found" });

    const deptFilter = buildDeptFilter(dept.name);

    const results = await Promise.all([
      Complaint.countDocuments(deptFilter),
      Complaint.countDocuments(Object.assign({}, deptFilter, { status: "resolved" })),
      Complaint.countDocuments(Object.assign({}, deptFilter, { status: "pending" })),
      Complaint.countDocuments(Object.assign({}, deptFilter, { status: { $in: ["assigned", "in_progress"] } })),
      Officer.countDocuments({ departmentName: dept.name }),
      Officer.countDocuments({ departmentName: dept.name, status: "Active" }),
    ]);

    res.json(Object.assign({}, dept.toObject(), {
      totalComplaints:      results[0],
      resolvedComplaints:   results[1],
      pendingComplaints:    results[2],
      inProgressComplaints: results[3],
      totalOfficers:        results[4],
      activeOfficers:       results[5],
    }));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/departments — create new department
router.post("/departments", async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) {
      return res.status(400).json({ message: "Department name is required." });
    }
    const existing = await Department.findOne({ name: name.trim() });
    if (existing) return res.status(409).json({ message: "Department '" + name + "' already exists." });

    const dept = await Department.create({ name: name.trim(), description: description || "" });
    res.status(201).json({ message: "Department created", department: dept });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: "Duplicate name or code." });
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/departments/:id — permanently delete
router.delete("/departments/:id", async (req, res) => {
  try {
    const dept = await Department.findByIdAndDelete(req.params.id);
    if (!dept) return res.status(404).json({ message: "Department not found." });
    res.json({ message: '"' + dept.name + '" deleted successfully.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
