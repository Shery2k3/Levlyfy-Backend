const jwt = require("jsonwebtoken");
const { jwtSecret } = require("../../config/config.js");

const authMiddleware = (req, res, next) => {
  const token = req?.cookies?.jwt || req?.headers.authorization?.split(" ")[1];

  // console.log("token in auth middleWARE : ", token);

  if (!token) {
    // console.log("no token provided in auth middleware");
    return res.status(401).json({ message: "Unauthorized: No token provided" });
  }

  jwt.verify(token, jwtSecret, (err, decoded) => {
    if (err) {
      console.log("error : ", err);
      console.log("JWT Error: ", err);
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    try {
      req.user = decoded.data;
    } catch (parseError) {
      console.log("Failed to parse user data from token", parseError);
      return res.status(500).json({ message: "Failed to parse user data" });
    }

    next();
  });
};

// const auth = async (req, res, next) => {
//   try {
//     const authHeader = c.req.header("Authorization")
//     if (!authHeader || !authHeader.startsWith("Bearer ")) {
//       return errorResponse(c, 401, "Unauthorized: No token provided");
//     }

//     const token = authHeader.split(" ")[1];
//     const decoded = await verify(token, jwtSecret);

//     const user = await user.findById(decoded.id).select("-password");
//     if (!user) {
//       return errorResponse(c, 401, "Unauthorized: Invalid token");
//     }

//     c.set("user", user);
//     await next();

//   } catch (error) {
//     console.error(error);
//     return errorResponse(c, 401, "Unauthorized: Invalid token");
//   }
// };

const isAdmin = (req, res, next) => {
  if (req.user.role.toLowerCase() !== "admin") {
    return res.status(403).json({ success: false, message: "Access denied" });
  }
  next();
}


module.exports = { authMiddleware, isAdmin };
