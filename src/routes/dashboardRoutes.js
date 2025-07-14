const express = require("express");
const router = express.Router();
const { authMiddleware, isAdmin } = require("../middleware/auth.middleware.js");
const {
  getUserRankings,
  getDashboardAnalytics,
  getUserDashboard
} = require("../controllers/dashboardController.js");

// User-specific dashboard (requires authentication)
router.get("/my-dashboard", authMiddleware, getUserDashboard);

// System-wide analytics (admin only)
router.get("/analytics", authMiddleware, authMiddleware, getDashboardAnalytics);

// User rankings leaderboard (requires authentication)
router.get("/rankings", authMiddleware, getUserRankings);

// Public rankings (limited data, no admin required)
router.get("/leaderboard", authMiddleware, getUserRankings);

module.exports = router;