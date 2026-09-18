const express = require("express");
const path = require("path");
const cors = require("cors");
const credentialRoutes =
  require("./routes/credentialRoutes");
const employeeRoutes = require("./routes/employeeRoutes");
const characterRoutes =
  require("./routes/characterRoutes");
const executionRoutes =
  require("./routes/executionRoutes");
  const authRoutes = require("./routes/authRoutes");
const connectionRoutes = require("./routes/connectionRoutes.js");
const analyticsRoutes =
  require("./routes/analyticsRoutes");

const app = express();



app.use(
  cors({
    origin: true,
    credentials: true
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(
  "/generated",
  express.static(
    path.join(process.cwd(), "generated")
  )
);
app.use(
  "/api/analytics",
  analyticsRoutes
);
app.use("/api/auth", authRoutes);
app.use("/api/employees", employeeRoutes);
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Laara Backend is running",
    service: "laara-backend"
  });
});
app.use(
  "/api/credentials",
  credentialRoutes
);
app.use(
  "/api/characters",
  characterRoutes
);
app.use(
  "/api/connections",
  connectionRoutes
);
app.use(
  "/api/execution",
  executionRoutes
);

module.exports = app;