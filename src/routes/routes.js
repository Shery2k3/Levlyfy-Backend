const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middleware/auth.middleware");
const authRoutes = require("./authRoutes");
const callRoutes = require("./callRoutes");
const performanceRoutes = require("./performanceRoutes");
const twilioRoutes = require("./twilioRoutes");

router.use("/auth", authRoutes);
router.use("/call", callRoutes); // Remove auth middleware for demo
router.use("/performance", authMiddleware, performanceRoutes);
router.use("/twilio", twilioRoutes);

module.exports = router;
