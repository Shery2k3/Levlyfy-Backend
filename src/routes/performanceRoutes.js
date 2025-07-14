const express = require("express");
const router = express.Router();

const { getLeaderboard, getMyStats } = require("../controllers/performanceController");

router.get("/leaderboard", getLeaderboard);
router.get("/leaderboard/me", getMyStats);

module.exports = router;
