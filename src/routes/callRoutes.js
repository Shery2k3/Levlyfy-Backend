const express = require("express");
const router = express.Router();
// const upload = require("../middleware/upload.middleware"); // Local upload - commented out
const { uploadToS3, handleS3UploadError, logS3Upload } = require("../middleware/s3Upload.middleware");
// const { isAdmin } = require("../middleware/auth.middleware"); // Commented for demo
const {
  uploadCall,
  reanalyzeCall,
  downloadDecryptedAudio,
} = require("../controllers/callController");

// S3 upload route with error handling
router.post("/upload-call", 
  uploadToS3.single("audio"), 
  handleS3UploadError,
  logS3Upload,
  uploadCall
);

// Comment out other routes that need database/auth
// router.post("/:id/reanalyze", isAdmin, reanalyzeCall);
// router.get("/:id/decrypted-audio", isAdmin, downloadDecryptedAudio);

// router.get("/test", testController); // Remove this undefined controller

module.exports = router;
