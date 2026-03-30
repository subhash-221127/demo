const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4']);


const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config();
const app = express();

// Enable CORS
app.use(cors());

// Body parser
app.use(express.json());

// Serve static frontend if needed
app.use(express.static(path.join(__dirname, "../frontend")));

// Serve uploaded evidence files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ---------------------------
// Routes
// ---------------------------
const userRoutes = require("./routes/auth"); // your login/signup routes
app.use("/api", userRoutes);

// Complaints
const complaintsRoutes = require("./routes/complaints");
app.use("/api", complaintsRoutes);

// Officers
const officerRoutes = require("./routes/officers");
app.use("/api", officerRoutes);

// Departments
const departmentRoutes = require("./routes/departments");
app.use("/api", departmentRoutes);

// Admin
const adminRoutes = require("./routes/admin");
app.use("/api", adminRoutes);

// ── Escalation scheduler ──────────────────────────────────────
const { startEscalationScheduler } = require("./escalation");

// ---------------------------
// MongoDB Connection
// ---------------------------
const MONGO_URI = process.env.MONGO_URI;

function connectToMongo(uri) {
  return mongoose.connect(uri)
    .then(() => console.log(`MongoDB connected (${uri})`))
    .catch(err => {
      console.error(`MongoDB connection error (${uri}):`, err);
      throw err;
    });
}

connectToMongo(MONGO_URI)
  .then(() => startEscalationScheduler())
  .catch(async () => {
    // If the primary URI fails, try localhost as a fallback (useful for offline development).
    const fallback = "mongodb://127.0.0.1:27017/complaint-management-system";
    if (MONGO_URI !== fallback) {
      console.log("Attempting fallback MongoDB URI (local) …");
      try {
        await connectToMongo(fallback);
        startEscalationScheduler();
      } catch (err) {
        console.error("Fallback MongoDB connection also failed. The server will start but database features may not work.");
      }
    }
  });

// ---------------------------
// Start Server
// ---------------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));