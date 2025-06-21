const {
  successResponse,
  errorResponse,
  validationErrorResponse,
  serverErrorResponse,
} = require("./baseController.js");
const { transcribeAudio } = require("../services/whisperService");
const processCall = require("../jobs/processCall.js");
const CallRepo = require("../repos/CallRepo.js");
const path = require("path");
const fs = require("fs");
const { decryptFile } = require("../utils/fileEncryption.js");
const { OpenAI } = require("openai");
require("dotenv").config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

uploadCall = async (req, res) => {
  try {
    // For demo - skip authentication
    const userId = 1; // Demo user ID
    const { callNotes } = req?.body || {};
    const file = req.file;

    // Validate file existence
    if (!file) {
      return validationErrorResponse(res, "Please upload an audio file");
    }

    console.log("📁 S3 File received:", {
      originalName: file.originalname,
      size: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
      mimeType: file.mimetype,
      s3Location: file.location,
      s3Key: file.key
    });

    // Create a demo call object (skip database for demo)
    const demoCall = {
      id: Date.now(), // Use timestamp as fake ID
      userId,
      status: "pending",
      audioUrl: file.location, // S3 file URL
      s3Key: file.key, // S3 file key for future operations
      callDate: new Date(),
      callNotes: callNotes || "",
    };

    // Process the call asynchronously (skip for demo)
    // setImmediate(() => processCall(demoCall, file));
    // console.log("⏭️ Skipping background processing for demo");

    return successResponse(
      res, 
      { 
        id: demoCall.id,
        status: "pending",
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

reanalyzeCall = async (req, res) => {
  const callId = req.params.id;

  const call = await CallRepo.findByPk(callId);
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

  await call.update({ status: "processing" });

  setImmediate(() => processCall(call));

  return successResponse(res, call, "Call reanalysis started successfully");
};

downloadDecryptedAudio = async (req, res) => {
  const { id } = req.params;
  const call = await CallRepo.findByPk(id);
  if (!call) return errorResponse(res, "Call not found", 404);

  // 1) Ensure temp folder exists
  const tempDir = path.resolve("temp");
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

  // 2) Define paths
  const encryptedPath = path.resolve(call.audioUrl);
  const decryptedName = `dec-${Date.now()}-${path.basename(call.audioUrl)}`;
  const decryptedPath = path.join(tempDir, decryptedName);

  // 3) Decrypt (sync version)
  try {
    await decryptFile(encryptedPath, decryptedPath);
  } catch (err) {
    console.error("Decrypt error:", err);
    return serverErrorResponse(res, "Could not decrypt file", 500);
  }

  // 4) Verify file exists
  if (!fs.existsSync(decryptedPath)) {
    return serverErrorResponse(res, "Decrypted file not found", 500);
  }

  // 5) Send it
  res.download(decryptedPath, decryptedName, (err) => {
    if (err) {
      console.error("Download error:", err);
      return serverErrorResponse(res, "Could not send file", 500);
    }
    // clean up
    fs.unlinkSync(decryptedPath);
  });
};

testController = async(req,res) => {

  const prompt = "generate me a counting from 1 to 10.";

  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      { role: "user", content: prompt }
    ],
    temperature: 0.5,
    max_tokens: 1000,
  })

  const content = response.choices[0].message.content;

  return successResponse(res, content, "Test successful");
}

module.exports = {
  uploadCall,
  reanalyzeCall,
  downloadDecryptedAudio,
};
