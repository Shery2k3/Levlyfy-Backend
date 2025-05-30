const express = require("express");
const router = express.Router();
const {
  loginUser,
  changePassword,
  forgetPassword,
  resetPasswordWithToken,
  signupUser,
} = require("../controllers/authController.js");
const {
  authMiddleware,
} = require("../middleware/auth.middleware.js");

router.post("/login", loginUser);
router.post("/signup", signupUser);
router.post(
  "/change-password",
  authMiddleware,
  changePassword
);
router.post("/forgot-password", forgetPassword);
router.post("/reset-password", resetPasswordWithToken);

module.exports = router;