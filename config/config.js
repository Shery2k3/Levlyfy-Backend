require('dotenv').config();

module.exports = {
  jwtSecret: process.env.JWT_SECRET || "your_default_secret_key",
  development: {
    username: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    dialect: "postgres",
    logging: false,
    jwtSecret: process.env.JWT_SECRET,
  },
  test: {
    username: "root",
    password: "",
    database: "test",
    host: "127.0.0.1",
    dialect: "postgres",
  },
  production: {
    username: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    dialect: "postgres",
    logging: false,
  },
};



