const express = require("express");
const router = express.Router();
const {
  signupValidator,
  loginValidator,
  changePasswordValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
} = require("../validators/authValidator.js");
const {
  loginUser,
  changePassword,
  forgetPassword,
  resetPasswordWithToken,
  signupUser,
} = require("../controllers/authController.js");
const { authMiddleware } = require("../middleware/auth.middleware.js");
const { validationResult } = require("express-validator");

function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }
  next();
}

router.post("/login", loginValidator, handleValidation, loginUser);
router.post("/signup", signupValidator, handleValidation, signupUser);
router.post(
  "/change-password",
  authMiddleware,
  changePasswordValidator,
  handleValidation,
  changePassword
);
router.post(
  "/forgot-password",
  forgotPasswordValidator,
  handleValidation,
  forgetPassword
);
router.post(
  "/reset-password",
  resetPasswordValidator,
  handleValidation,
  resetPasswordWithToken
);

module.exports = router;