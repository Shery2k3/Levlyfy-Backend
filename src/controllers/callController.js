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
require("dotenv").config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function uploadCall(req, res) {
  try {
    const userId = req.user?._id || req.body.userId || null;
    const { callNotes } = req?.body || {};
    const file = req.file;
    if (!file) {
      return validationErrorResponse(res, "Please upload an audio file");
    }
    if (!userId) {
      return validationErrorResponse(res, "User ID is required");
    }
    console.log("📁 S3 File received:", {
      originalName: file.originalname,
      size: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
      mimeType: file.mimetype,
      s3Location: file.location,
      s3Key: file.key
    });
    const newCall = await Call.create({
      userId,
      status: "pending",
      audioUrl: file.location,
      s3Key: file.key,
      callDate: new Date(),
      callNotes: callNotes || "",
    });
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