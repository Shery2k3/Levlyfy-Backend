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
  contacts: [{
    name: { type: String, required: true },
    phone: { type: String, required: true },
    notes: { type: String, default: '' },
    tags: [{ type: String }],
    createdAt: { type: Date, default: Date.now }
  }],
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