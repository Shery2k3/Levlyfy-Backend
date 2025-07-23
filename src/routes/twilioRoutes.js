const express = require("express");
const {
  generateAccessToken,
  voice,
  recordingStatus,
  callStarted,
} = require("../controllers/twilioController");
const { authMiddleware } = require("../middleware/auth.middleware");

const router = express.Router();

router.get("/token", authMiddleware, generateAccessToken);
router.post("/voice", voice);
router.post("/recording-status", recordingStatus); // No auth needed
router.post("/call-started", authMiddleware, callStarted)

module.exports = router;
