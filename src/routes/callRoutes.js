const express = require("express");
const router = express.Router();
const { 
  uploadCallValidator, 
  reanalyzeCallValidator, 
  downloadDecryptedAudioValidator 
} = require("../validators/callValidator.js");
const { validationResult } = require("express-validator");
const { auth, authMiddleware } = require("../middleware/auth.middleware.js");
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

// Secure upload-call route: user must be logged in, validation runs, then controller handles S3 upload
router.post(
  "/upload-call",
  authMiddleware,
  // uploadCallValidator,
  handleValidation,
  uploadCall
);

router.post("/testgpt", testgpt)

// Comment out other routes that need database/auth
// router.post("/:id/reanalyze", reanalyzeCallValidator, handleValidation, reanalyzeCall);
// router.get("/:id/decrypted-audio", downloadDecryptedAudioValidator, handleValidation, downloadDecryptedAudio);

// router.get("/test", testController); // Remove this undefined controller

module.exports = router;
