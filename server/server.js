require("dotenv").config();

const path = require("path");
const express = require("express");
const cors = require("cors");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const APP_DIR = path.join(__dirname, "../app");

app.use(cors());
app.use(express.json({ limit: "10mb" }));

/* -----------------------------
   STATIC SITE
----------------------------- */

app.use(express.static(APP_DIR));

app.get("/", (_req, res) => {
  res.sendFile(path.join(APP_DIR, "index.html"));
});

/* -----------------------------
   HEALTH
----------------------------- */

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "kylor",
    version: "1.0.0",
    status: "running"
  });
});

/* -----------------------------
   FALLBACK
----------------------------- */

app.use((req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({
      ok: false,
      error: "API endpoint not found.",
      path: req.path
    });
  }

  res.sendFile(path.join(APP_DIR, "index.html"));
});

/* -----------------------------
   SERVER
----------------------------- */

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Kylor running on port ${PORT}`);
  console.log(`Kylor UI: http://localhost:${PORT}`);
});
