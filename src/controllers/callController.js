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
    const userId = req.user.id;
    const { callNotes } = req?.body || {};
    const file = req.file;

    // Validate file existence
    if (!file) {
      return validationErrorResponse(res, "Please upload an audio file");
    }

    // Validate file type (optional but recommended)
    const allowedTypes = ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg', 'video/mp4'];
    const mimeType = file.mimetype;
    
    if (!allowedTypes.includes(mimeType)) {
      return validationErrorResponse(
        res, 
        `Unsupported file type: ${mimeType}. Please upload mp3, mp4, wav, or ogg files.`
      );
    }

    // Validate file size (optional but recommended, e.g., 25MB limit)
    const MAX_SIZE = 25 * 1024 * 1024; // 25MB
    if (file.size > MAX_SIZE) {
      return validationErrorResponse(
        res,
        `File too large. Maximum size is ${MAX_SIZE / (1024 * 1024)}MB`
      );
    }

    // Create a new call record
    const newCall = await CallRepo.createCall({
      userId,
      status: "pending",
      audioUrl: file.path,
      callDate: new Date(),
      callNotes: callNotes || "",
    });

    // Process the call asynchronously
    setImmediate(() => processCall(newCall, file));

    return successResponse(
      res, 
      { 
        id: newCall.id,
        status: "pending" 
      }, 
      "Call uploaded successfully and queued for processing"
    );
  } catch (error) {
    console.error("Error in uploadCall controller:", error);
    return errorResponse(res, error.message || "Failed to upload call");
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
