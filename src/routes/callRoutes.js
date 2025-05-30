const express = require("express");
const router = express.Router();
const upload = require("../middleware/upload.middleware");
const { isAdmin } = require("../middleware/auth.middleware");
const {
  uploadCall,
  reanalyzeCall,
  downloadDecryptedAudio,
} = require("../controllers/callController");

router.post("/upload-call", upload.single("audio"), uploadCall);
router.post("/:id/reanalyze", isAdmin, reanalyzeCall);
router.get("/:id/decrypted-audio", isAdmin, downloadDecryptedAudio);

router.get("/test", testController);

module.exports = router;
