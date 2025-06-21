// config/mongo.js
// MongoDB connection using Mongoose
require('dotenv').config();
const mongoose = require('mongoose');

const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/levlyfy';

const connectDB = async () => {
  try {
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  }
};

module.exports = connectDB;
