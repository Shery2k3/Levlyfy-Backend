const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const routes = require("./routes/routes.js");
const errorMiddleware = require("./middleware/error.middleware.js");
const connectDB = require("../config/db.js");

dotenv.config();

// Connect to MongoDB before starting the app
connectDB();

const app = express();

// CORS should be first
const allowedOrigins = "*";
app.use(cors({ origin: allowedOrigins }));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Routes
app.use("/api", routes);

app.get("/", (req, res) => {
  res.send("Welcome to the AI CRM Backend!");
});

// Error handling should be last
app.use(errorMiddleware);

module.exports = app;