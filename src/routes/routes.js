const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middleware/auth.middleware");
const authRoutes = require("./authRoutes");
const callRoutes = require("./callRoutes");
const performanceRoutes = require("./performanceRoutes");

router.use("/auth", authRoutes);
router.use("/call", authMiddleware, callRoutes);
router.use("/performance", authMiddleware, performanceRoutes);

module.exports = router;
