const express = require("express");
const router = express.Router();
const { getToken, voice } = require("../controllers/twillioController.js");

router.get("/token", getToken);
router.post("/voice", voice);

module.exports = router;
