const express = require("express");
const {
  generateAccessToken,
  voice,
} = require("../controllers/twilioController");

const router = express.Router();

router.get("/token", generateAccessToken);
router.post("/voice", voice);

module.exports = router;
