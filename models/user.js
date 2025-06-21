'use strict';
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: {
    type: String,
  },
  address: {
    type: String,
  },
  profilePicture: {
    type: String,
  },
  role: {
    type: String,
  },
  isDeleted: {
    type: Boolean,
    default: false,
  },
  resetPasswordToken: {
    type: String,
  },
  resetPasswordExpires: {
    type: Date,
  },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);