const {
  successResponse,
  errorResponse,
  validationErrorResponse,
  serverErrorResponse,
} = require("../utils/response.js");
const { transcribeAudio } = require("../services/whisperService");
const processCall = require("../jobs/processCall.js");
const path = require("path");
const fs = require("fs");
const { decryptFile } = require("../utils/fileEncryption.js");
const { OpenAI } = require("openai");
const Call = require("../../models/call.js");
const {
  uploadToS3,
  deleteFromS3,
} = require("../middleware/upload.middleware.js");
const { analyzeCall } = require("../services/gptService.js");
require("dotenv").config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function uploadCall(req, res) {
  try {
    // User is authenticated, get userId from token
    const userId = req.user?._id;
    console.log("User ID from token:", userId);
    if (!userId) {
      return validationErrorResponse(res, "User authentication failed");
    }
    // 1. Upload file to S3
    uploadToS3.single("audio")(req, res, async function (err) {
      if (err) {
        return errorResponse(
          res,
          err.message || "Failed to upload file to S3",
          500
        );
      }
      const file = req.file;
      if (!file) {
        return validationErrorResponse(res, "No audio file provided");
      }
      // 2. Create Call document with S3 info
      const { callNotes } = req.body || {};
      try {
        const newCall = await Call.create({
          userId,
          status: "uploaded",
          callNotes: callNotes || "",
          audioUrl: file.location,
          s3Key: file.key,
        });
        return successResponse(
          res,
          {
            id: newCall._id,
            status: newCall.status,
            message: "File uploaded successfully to S3",
            s3Location: file.location,
            s3Key: file.key,
            fileSize: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
          },
          "Call uploaded successfully to cloud storage"
        );
      } catch (dbError) {
        // If DB save fails, delete the S3 file to avoid orphaned files
        deleteFromS3(file.key).catch((deleteError) => {
          console.error(
            "Failed to delete S3 file after DB error:",
            deleteError
          );
        });
        console.error("DB save error:", dbError);
      }
    });
  } catch (error) {
    console.error("Error in uploadCall controller:", error);
    return errorResponse(res, error.message || "Failed to upload call", 500);
  }
}

async function reanalyzeCall(req, res) {
  const callId = req.params.id;
  const call = await Call.findById(callId);
  if (!call) {
    return errorResponse(res, "Call not found", 400);
  }
  if (!["failed", "pending"].includes(call.status)) {
    return errorResponse(
      res,
      "Call is already being processed or has been completed",
      400
    );
  }
  call.status = "processing";
  await call.save();
  setImmediate(() => processCall(call));
  return successResponse(res, call, "Call reanalysis started successfully");
}

async function downloadDecryptedAudio(req, res) {
  const { id } = req.params;
  const call = await Call.findById(id);
  if (!call) return errorResponse(res, "Call not found", 404);
  const tempDir = path.resolve("temp");
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
  const encryptedPath = path.resolve(call.audioUrl);
  const decryptedName = `dec-${Date.now()}-${path.basename(call.audioUrl)}`;
  const decryptedPath = path.join(tempDir, decryptedName);
  try {
    await decryptFile(encryptedPath, decryptedPath);
  } catch (err) {
    console.error("Decrypt error:", err);
    return serverErrorResponse(res, "Could not decrypt file", 500);
  }
  if (!fs.existsSync(decryptedPath)) {
    return serverErrorResponse(res, "Decrypted file not found", 500);
  }
  res.download(decryptedPath, decryptedName, (err) => {
    if (err) {
      console.error("Download error:", err);
      return serverErrorResponse(res, "Could not send file", 500);
    }
    fs.unlinkSync(decryptedPath);
  });
}

async function testgpt(req, res) {
  // const transcript = "This is a test call transcript for analysis.";
  const { transcript } =
    req.body || "This is a test call transcript for analysis.";

  const response = await analyzeCall(transcript);
  if (!response) {
    return errorResponse(res, "Failed to analyze call transcript", 500);
  }

  return successResponse(
    res,
    response,
    "Call transcript analyzed successfully"
  );
}

module.exports = {
  uploadCall,
  reanalyzeCall,
  downloadDecryptedAudio,
  testgpt,
};
