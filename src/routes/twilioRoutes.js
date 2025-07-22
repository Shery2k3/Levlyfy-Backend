const express = require("express");
const {
  generateAccessToken,
  voice,
} = require("../controllers/twilioController");
const { authMiddleware } = require("../middleware/auth.middleware");

const router = express.Router();

router.get("/token", authMiddleware, generateAccessToken);
router.post("/voice", voice);

module.exports = router;
