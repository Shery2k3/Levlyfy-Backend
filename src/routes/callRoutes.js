const express = require("express");
const router = express.Router();
const { 
  uploadCallValidator, 
  reanalyzeCallValidator, 
  downloadDecryptedAudioValidator 
} = require("../validators/callValidator.js");
const { validationResult } = require("express-validator");
const { auth, authMiddleware } = require("../middleware/auth.middleware.js");
const { uploadToS3 } = require("../middleware/upload.middleware.js");
const {
  uploadCall,
  reanalyzeCall,
  downloadDecryptedAudio,
  testgpt,
} = require("../controllers/callController");

function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }
  next();
}

// Secure upload-call route: middleware chain approach
router.post(
  "/upload-call",
  authMiddleware,                    // 1. Check authentication
  uploadToS3.single("audio"),        // 2. Upload file to S3
  // uploadCallValidator,             // 3. Validate (if needed)
  handleValidation,                  // 4. Handle validation errors
  uploadCall                         // 5. Save to database
);

router.post("/testgpt", testgpt)

// Comment out other routes that need database/auth
// router.post("/:id/reanalyze", reanalyzeCallValidator, handleValidation, reanalyzeCall);
// router.get("/:id/decrypted-audio", downloadDecryptedAudioValidator, handleValidation, downloadDecryptedAudio);

// router.get("/test", testController); // Remove this undefined controller

module.exports = router;
