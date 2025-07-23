const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const constants = require("../utils/constants.js");
const { jwtSecret } = require("../../config/config.js");
const {
  successResponse,
  errorResponse,
  validationErrorResponse,
} = require("../utils/response.js");
const User = require("../../models/user.js");

function signToken(userResponse) {
  return jwt.sign({ data: userResponse }, jwtSecret, {
    expiresIn: constants.expiresIn || "30d",
  });
}

async function signupUser(req, res) {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) {
    return validationErrorResponse(
      res,
      "Name, email, and password are required"
    );
  }
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return errorResponse(res, "Email already registered", 400);
  }
  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await User.create({
    name,
    email,
    password: hashedPassword,
    role,
  });
  user.password = undefined;
  let token = signToken(user);
  return successResponse(res, { user, token }, "Signup successful");
}

async function loginUser(req, res) {
  const { email, password } = req.body;
  if (!email || !password) {
    return validationErrorResponse(res, "Email and password are required");
  }
  const user = await User.findOne({ email });
  if (!user) {
    return errorResponse(res, "Invalid credentials", 400);
  }
  const passwordMatch = await bcrypt.compare(password, user.password);
  if (!passwordMatch) {
    return errorResponse(res, "Invalid credentials", 400);
  }
  user.password = undefined;
  let token = signToken(user);
  return successResponse(res, { user, token }, "login Successful");
}

async function changePassword(req, res) {
  const { email, oldPassword, newPassword } = req.body;
  if (!email || !newPassword || !oldPassword) {
    return validationErrorResponse(
      res,
      "Email, old password, and new password are required"
    );
  }
  if (oldPassword === newPassword) {
    return errorResponse(
      res,
      "New Password should not equal to old Password",
      200
    );
  }
  const user = await User.findOne({ email });
  if (!user) {
    return errorResponse(res, "User not found", 200);
  }
  const passwordMatch = await bcrypt.compare(oldPassword, user?.password);
  if (!passwordMatch) {
    return errorResponse(res, "Invalid old password", 400);
  }
  const hashedPassword = await bcrypt.hash(
    newPassword,
    Number(process.env.SALT_ROUNDS)
  );
  user.password = hashedPassword;
  await user.save();
  return successResponse(res, {}, "Password changed successfully");
}

async function forgetPassword(req, res) {
  const { email } = req.body;
  if (!email) {
    return validationErrorResponse(res, "Email is required");
  }
  const user = await User.findOne({ email });
  if (!user) {
    return errorResponse(res, "User not found", 200);
  }
  const resetToken = crypto.randomBytes(constants.hexCode).toString("hex");
  const encryptedToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");
  user.resetPasswordToken = encryptedToken;
  user.resetPasswordExpires = Date.now() + 10 * 60 * 1000;
  await user.save({
    validateBeforeSave: false,
  });
  return successResponse(res, {}, "Resent link sent successful");
}

async function resetPasswordWithToken(req, res) {
  const { token } = req.query;
  const { newPassword } = req.body;
  if (!token || !newPassword) {
    return validationErrorResponse(res, "Token and new password are required");
  }
  const encryptedToken = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
  const user = await User.findOne({
    resetPasswordToken: encryptedToken,
    resetPasswordExpires: { $gt: Date.now() },
  });
  if (!user || user?.resetPasswordExpires < Date.now()) {
    return errorResponse(res, "Token is invalid or has expired", 400);
  }
  const hashedPassword = await bcrypt.hash(
    newPassword,
    Number(process.env.SALT_ROUNDS)
  );
  user.password = hashedPassword;
  user.resetPasswordToken = null;
  user.resetPasswordExpires = null;
  await user?.save();
  return successResponse(res, {}, "Password reset successfully");
}

module.exports = {
  loginUser,
  signupUser,
  changePassword,
  forgetPassword,
  resetPasswordWithToken,
};
