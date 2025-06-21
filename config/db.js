require("dotenv").config();
const mongoose = require("mongoose");
const colors = require("colors");

const mongoURI = process.env.MONGO_URI || "mongodb://localhost:27017/levlyfy";

const connectDB = async () => {
  try {
    const connection = await mongoose.connect(mongoURI);
    console.log(
      `Connected to ${connection.connection.name} at ${connection.connection.host}`
        .yellow.bold
    );
  } catch (err) {
    console.error(colors.red("MongoDB connection error:"), err);
    process.exit(1);
  }
};

module.exports = connectDB;
