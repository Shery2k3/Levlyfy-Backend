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
    expiresIn: constants.expiresIn || "23h",
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

async function getUserProfile(req, res) {
  try {
    console.log("getUserProfile - req.user:", req.user);
    const userId = req.user.data?._id || req.user._id;
    console.log("getUserProfile - userId:", userId);
    const user = await User.findById(userId).select('-password');
    if (!user) {
      return errorResponse(res, "User not found", 404);
    }
    console.log("getUserProfile - found user with contacts:", user.contacts?.length || 0);
    return successResponse(res, { user }, "User profile retrieved successfully");
  } catch (error) {
    console.error("getUserProfile error:", error);
    return errorResponse(res, "Server error", 500);
  }
}

async function addContact(req, res) {
  try {
    const userId = req.user.data?._id || req.user._id;
    const { name, phone, notes } = req.body;
    
    console.log("addContact - userId:", userId, "data:", { name, phone, notes });
    
    if (!name || !phone) {
      return validationErrorResponse(res, "Name and phone are required");
    }

    const user = await User.findById(userId);
    if (!user) {
      return errorResponse(res, "User not found", 404);
    }

    // Check if contact with same phone already exists for this user
    const existingContact = user.contacts.find(contact => contact.phone === phone);
    if (existingContact) {
      return errorResponse(res, "Contact with this phone number already exists", 400);
    }

    const newContact = {
      name,
      phone,
      notes: notes || '',
      createdAt: new Date()
    };

    user.contacts.push(newContact);
    await user.save();

    const addedContact = user.contacts[user.contacts.length - 1];
    return successResponse(res, { contact: addedContact }, "Contact added successfully");
  } catch (error) {
    console.log(error)
    return errorResponse(res, "Server error", 500);
  }
}

async function updateContact(req, res) {
  try {
    const userId = req.user.data?._id || req.user._id;
    const { contactId } = req.params;
    const { name, phone, notes } = req.body;

    if (!name || !phone) {
      return validationErrorResponse(res, "Name and phone are required");
    }

    const user = await User.findById(userId);
    if (!user) {
      return errorResponse(res, "User not found", 404);
    }

    const contactIndex = user.contacts.findIndex(contact => contact._id.toString() === contactId);
    if (contactIndex === -1) {
      return errorResponse(res, "Contact not found", 404);
    }

    // Check if another contact with same phone exists (excluding current contact)
    const existingContact = user.contacts.find((contact, index) => 
      contact.phone === phone && index !== contactIndex
    );
    if (existingContact) {
      return errorResponse(res, "Another contact with this phone number already exists", 400);
    }

    user.contacts[contactIndex].name = name;
    user.contacts[contactIndex].phone = phone;
    user.contacts[contactIndex].notes = notes || '';
    
    await user.save();

    return successResponse(res, { contact: user.contacts[contactIndex] }, "Contact updated successfully");
  } catch (error) {
    return errorResponse(res, "Server error", 500);
  }
}

async function deleteContact(req, res) {
  try {
    const userId = req.user.data?._id || req.user._id;
    const { contactId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return errorResponse(res, "User not found", 404);
    }

    const contactIndex = user.contacts.findIndex(contact => contact._id.toString() === contactId);
    if (contactIndex === -1) {
      return errorResponse(res, "Contact not found", 404);
    }

    user.contacts.splice(contactIndex, 1);
    await user.save();

    return successResponse(res, {}, "Contact deleted successfully");
  } catch (error) {
    return errorResponse(res, "Server error", 500);
  }
}

module.exports = {
  loginUser,
  signupUser,
  changePassword,
  forgetPassword,
  resetPasswordWithToken,
  getUserProfile,
  addContact,
  updateContact,
  deleteContact,
};
