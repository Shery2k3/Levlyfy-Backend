const express = require("express");
const router = express.Router();
const { getToken, voice,startCall  } = require("../controllers/twillioController.js");

router.get("/token", getToken);
router.post("/voice", voice);
router.post("/start-call", startCall )

module.exports = router;
