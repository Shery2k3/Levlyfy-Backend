const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middleware/auth.middleware");
const { getToken, voice, startCall } = require("../controllers/twillioController.js");

// Token endpoint needs auth (user requesting token)
router.get("/token", authMiddleware, getToken);

// Voice webhook does NOT need auth (Twilio calling it)
router.post("/voice", voice);

// Start call needs auth (user initiating call)
router.post("/start-call", authMiddleware, startCall);

module.exports = router;
