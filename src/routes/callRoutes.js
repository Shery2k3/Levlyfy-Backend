const express = require("express");
const router = express.Router();
const { 
  uploadCallValidator, 
  reanalyzeCallValidator, 
  downloadDecryptedAudioValidator 
} = require("../validators/callValidator.js");
const { validationResult } = require("express-validator");
const { 
  uploadToS3, 
  handleS3UploadError, 
  logS3Upload 
} = require("../middleware/s3Upload.middleware");
const {
  uploadCall,
  reanalyzeCall,
  downloadDecryptedAudio,
} = require("../controllers/callController");

function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }
  next();
}

// S3 upload route with error handling
router.post("/upload-call", 
  uploadToS3.single("audio"), 
  handleS3UploadError,
  logS3Upload,
  uploadCallValidator,
  handleValidation,
  uploadCall
);

// Comment out other routes that need database/auth
// router.post("/:id/reanalyze", reanalyzeCallValidator, handleValidation, reanalyzeCall);
// router.get("/:id/decrypted-audio", downloadDecryptedAudioValidator, handleValidation, downloadDecryptedAudio);

// router.get("/test", testController); // Remove this undefined controller

module.exports = router;
