const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const dotenv = require("dotenv");
const routes = require("./routes/routes.js");
const errorMiddleware = require("./middleware/error.middleware.js");
const connectDB = require("../config/db.js");

dotenv.config();

// Connect to MongoDB before starting the app
connectDB();

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const allowedOrigins = "*";
app.use(cors({ origin: allowedOrigins }));

app.use("/api", routes);

app.get("/", (req, res) => {
  res.send("Welcome to the AI CRM Backend!");
});

app.use(errorMiddleware);

module.exports = app;
