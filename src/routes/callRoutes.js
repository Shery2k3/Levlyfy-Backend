const express = require("express");
const router = express.Router();
const {
  uploadCallValidator,
  reanalyzeCallValidator,
  downloadDecryptedAudioValidator,
} = require("../validators/callValidator.js");
const { validationResult } = require("express-validator");
const { authMiddleware } = require("../middleware/auth.middleware.js");
const { uploadToS3 } = require("../middleware/upload.middleware.js");
const {
  uploadCall,
  reanalyzeCall,
  downloadDecryptedAudio,
  testgpt,
  testTranscription,
  analyzeCallComplete,
  getAllUserCalls,
  getCallStatus,
  uploadCallRecording,
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
  authMiddleware, // 1. Check authentication
  uploadToS3.single("audio"), // 2. Upload file to S3
  // uploadCallValidator,             // 3. Validate (if needed)
  handleValidation, // 4. Handle validation errors
  uploadCall // 5. Save to database
);

// No auth for twilio
router.post(
  "/upload-call-recording",
  uploadToS3.single("audio"), // Upload file to S3
  authMiddleware, // This will work with system tokens
  uploadCallRecording // Process Twilio recording
);

router.post("/testgpt", testgpt);

router.post("/transcribe/:callId", authMiddleware, testTranscription);

// New route for testing transcription with just callId
router.post("/test-transcription", authMiddleware, testTranscription);

// Complete analysis route: transcribe + analyze
router.post("/analyze-complete/:callId", authMiddleware, analyzeCallComplete);

// Get all calls for authenticated user
router.get("/my-calls", authMiddleware, getAllUserCalls);

// Get call processing status
router.get("/status/:callId", authMiddleware, getCallStatus);

// Comment out other routes that need database/auth
// router.post("/:id/reanalyze", reanalyzeCallValidator, handleValidation, reanalyzeCall);
// router.get("/:id/decrypted-audio", downloadDecryptedAudioValidator, handleValidation, downloadDecryptedAudio);

// router.get("/test", testController); // Remove this undefined controller

module.exports = router;
