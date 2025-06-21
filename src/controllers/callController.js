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
const { uploadToS3 } = require("../middleware/s3Upload.middleware.js");
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
    // 1. Create Call document (pending, no audioUrl yet)
    const { callNotes } = req.body || {};
    const newCall = await Call.create({
      userId,
      status: "pending",
      callNotes: callNotes || "",
      // audioUrl, s3Key, etc. will be added after S3 upload
    });
    // 2. Upload file to S3
    uploadToS3.single("audio")(req, res, async function (err) {
      if (err) {
        // S3 upload failed, delete the Call document
        await Call.findByIdAndDelete(newCall._id);
        return errorResponse(res, err.message || "Failed to upload file to S3", 500);
      }
      const file = req.file;
      if (!file) {
        await Call.findByIdAndDelete(newCall._id);
        return validationErrorResponse(res, "No audio file provided");
      }
      // 3. Update Call document with S3 info
      newCall.audioUrl = file.location;
      newCall.s3Key = file.key;
      newCall.status = "uploaded";
      await newCall.save();
      return successResponse(
        res,
        {
          id: newCall._id,
          status: newCall.status,
          message: "File uploaded successfully to S3",
          s3Location: file.location,
          s3Key: file.key,
          fileSize: `${(file.size / 1024 / 1024).toFixed(2)}MB`
        },
        "Call uploaded successfully to cloud storage"
      );
    });
  } catch (error) {
    console.error("Error in uploadCall controller:", error);
    return errorResponse(res, error.message || "Failed to upload call", 500);
  }
};

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
};

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
};

async function testController(req, res) {
  const prompt = "generate me a counting from 1 to 10.";
  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      { role: "user", content: prompt }
    ],
    temperature: 0.5,
    max_tokens: 1000,
  });
  const content = response.choices[0].message.content;
  return successResponse(res, content, "Test successful");
};

module.exports = {
  uploadCall,
  reanalyzeCall,
  downloadDecryptedAudio,
  testController,
};