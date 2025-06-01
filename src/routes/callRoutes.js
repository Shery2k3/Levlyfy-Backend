const express = require("express");
const router = express.Router();
const upload = require("../middleware/upload.middleware");
// const { isAdmin } = require("../middleware/auth.middleware"); // Commented for demo
const {
  uploadCall,
  reanalyzeCall,
  downloadDecryptedAudio,
} = require("../controllers/callController");

// Remove authentication for demo
router.post("/upload-call", upload.single("audio"), uploadCall);

// Comment out other routes that need database/auth
// router.post("/:id/reanalyze", isAdmin, reanalyzeCall);
// router.get("/:id/decrypted-audio", isAdmin, downloadDecryptedAudio);

// router.get("/test", testController); // Remove this undefined controller

module.exports = router;
