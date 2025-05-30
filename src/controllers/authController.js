const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { Op } = require("sequelize");
const db = require("../../models/index.js");
const constants = require("../utils/constants.js");
const UserRepo = require("../repos/UserRepo.js");
const { jwtSecret } = require("../../config/config.js");
const {
  successResponse,
  errorResponse,
  validationErrorResponse,
} = require("./baseController.js");

signToken = (userResponse) => {
  return jwt.sign({ data: userResponse }, jwtSecret, {
    expiresIn: constants.expiresIn || "23h",
  });
};

loginUser = async (req, res) => {

  const { email, password } = req.body;

  if (!email || !password) {
    return validationErrorResponse(res, "Email and password are required");
  }

  const customQuery = {
    where: { email },

  };

  const user = await UserRepo?.findUserWithInclude(customQuery);

  if (!user) {
    return errorResponse(res, "Invalid credentials", 400);
  }

  const passwordMatch = await bcrypt.compare(password, user?.password);

  if (!passwordMatch) {
    return errorResponse(res, "Invalid credentials", 400);
  }

  user.password = undefined;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;

  let token = signToken(user);

  return successResponse(res, { user, token }, "login Successful");
};

signupUser = async (req, res) => {

  const { name,email, password,role } = req.body;

  const customQuery = {
    where: { email },
  };

  const user = await UserRepo?.findUserWithInclude(customQuery);

  if (user) {
    return errorResponse(res, "User already exists", 400);
  }

  const hashedPassword = await bcrypt.hash(
    password,
    Number(process.env.SALT_ROUNDS)
  );

  const newUser = await UserRepo?.createUser({
    name,
    email,
    password: hashedPassword,
    role,
  });

  newUser.password = undefined;
  newUser.resetPasswordToken = undefined;
  newUser.resetPasswordExpires = undefined;

  let token = signToken(newUser);

  return successResponse(
    res,
    { user: newUser, token },
    "signup Successful"
  );
};

changePassword = async (req, res) => {
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

  const customQuery = {
    email
  };

  const user = await UserRepo?.findUserWithInclude(customQuery);

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

  const updatedUser = await UserRepo?.updateUser(
    { password: hashedPassword },
    user?.id
  );

  user.isNewUser = false;

  const userObject = updatedUser.toJSON();

  delete userObject.password;
  delete userObject.resetPasswordToken;
  delete userObject.resetPasswordExpires;

  return successResponse(res, userObject, "Password changed successfully");
};

forgetPassword = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return validationErrorResponse(res, "Email is required");
  }

  const customQuery = {
    where: { email },
  };

  const user = await UserRepo?.findUserWithInclude(customQuery);

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
};

resetPasswordWithToken = async (req, res) => {
  const { token } = req.query;
  const { newPassword } = req.body;

  if (!token || !newPassword) {
    return validationErrorResponse(
      res,
      "Token and new password are required"
    );
  }

  const encryptedToken = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");

  const customQuery = {
    resetPasswordToken: encryptedToken,
    resetPasswordExpires: {
      [Op.gt]: Date.now(),
    },
  };

  const user = await UserRepo?.findUser(customQuery);

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
  await UserRepo?.updateUser({ isNewUser: false }, user?.id);

  return successResponse(res, {}, "Password reset successfully");
};

module.exports = {
  loginUser,
  signupUser,
  changePassword,
  forgetPassword,
  resetPasswordWithToken,
};
