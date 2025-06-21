'use strict';

const fs = require('fs');
const path = require('path');
const process = require('process');
const basename = path.basename(__filename);
const env = process.env.NODE_ENV || 'development';
const config = require(__dirname + '/../config/config.json')[env];
const db = {};

// Remove Performance model, only export User and Call
const User = require('./user');
const Call = require('./call');

module.exports = {
  User,
  Call,
};
