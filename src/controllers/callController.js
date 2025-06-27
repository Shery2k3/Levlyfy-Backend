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

    // File has already been uploaded to S3 by multer middleware
    const file = req.file;
    if (!file) {
      return validationErrorResponse(res, "No audio file provided");
    }

    console.log("File uploaded to S3:", {
      location: file.location,
      key: file.key,
      size: file.size,
    });

    // Create Call document with S3 info
    const { callNotes } = req.body || {};

    const newCall = await Call.create({
      userId,
      status: "uploaded",
      callNotes: callNotes || "",
      audioUrl: file.location,
      s3Key: file.key, // Save the S3 key as well
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
  } catch (error) {
    // If DB save fails, delete the S3 file to avoid orphaned files
    if (req.file?.key) {
      deleteFromS3(req.file.key).catch((deleteError) => {
        console.error("Failed to delete S3 file after DB error:", deleteError);
      });
    }

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

async function testTranscription(req, res) {
  try {
    // Accept callId from either URL params or request body
    const callId = req.params.callId || req.body.callId;
    
    if (!callId) {
      return validationErrorResponse(res, "Call ID is required");
    }

    // Find the call in database
    const call = await Call.findById(callId);
    if (!call) {
      return errorResponse(res, "Call not found", 404);
    }

    if (!call.audioUrl) {
      return errorResponse(res, "No audio file found for this call", 400);
    }

    console.log(`🎯 Testing transcription for call ${callId}`);
    console.log(`📁 Audio URL: ${call.audioUrl}`);

    // Update call status to processing
    await Call.findByIdAndUpdate(callId, { status: "processing" });

    // Transcribe the audio using the direct S3 URL
    const startTime = Date.now();
    const transcript = await transcribeAudio(call.audioUrl, true);
    const processingTime = Date.now() - startTime;

    if (!transcript || transcript.trim() === "") {
      await Call.findByIdAndUpdate(callId, { status: "failed" });
      return errorResponse(res, "Failed to transcribe audio - empty result", 500);
    }

    // Save transcript to database and update status
    await Call.findByIdAndUpdate(callId, { 
      transcript,
      status: "transcribed"
    });

    return successResponse(
      res,
      {
        callId,
        transcript,
        transcriptLength: transcript.length,
        wordCount: transcript.split(' ').length,
        processingTimeMs: processingTime,
        method: "Direct S3 URL (optimized)"
      },
      "Audio transcribed successfully"
    );

  } catch (error) {
    console.error("Test transcription error:", error);
    
    // Update call status to failed if we have a callId
    const callId = req.params.callId || req.body.callId;
    if (callId) {
      await Call.findByIdAndUpdate(callId, { status: "failed" }).catch(console.error);
    }
    
    return errorResponse(res, error.message || "Failed to transcribe audio", 500);
  }
}

async function analyzeCallComplete(req, res) {
  try {
    // Accept callId from either URL params or request body
    const callId = req.params.callId || req.body.callId;
    
    if (!callId) {
      return validationErrorResponse(res, "Call ID is required");
    }

    // Find the call in database
    const call = await Call.findById(callId);
    if (!call) {
      return errorResponse(res, "Call not found", 404);
    }

    if (!call.audioUrl) {
      return errorResponse(res, "No audio file found for this call", 400);
    }

    console.log(`🎯 Starting complete analysis for call ${callId}`);
    console.log(`📁 Audio URL: ${call.audioUrl}`);

    // Update call status to processing
    await Call.findByIdAndUpdate(callId, { status: "processing" });

    const startTime = Date.now();

    // Step 1: Transcribe the audio
    console.log("🎙️ Step 1: Transcribing audio...");
    const transcript = await transcribeAudio(call.audioUrl, true);

    if (!transcript || transcript.trim() === "") {
      await Call.findByIdAndUpdate(callId, { status: "failed" });
      return errorResponse(res, "Failed to transcribe audio - empty result", 500);
    }

    const transcriptionTime = Date.now() - startTime;
    console.log(`✅ Transcription completed in ${transcriptionTime}ms`);

    // Step 2: Analyze the transcript
    console.log("🧠 Step 2: Analyzing transcript...");
    const analysisStartTime = Date.now();
    const analysis = await analyzeCall(transcript);
    const analysisTime = Date.now() - analysisStartTime;
    
    console.log(`✅ Analysis completed in ${analysisTime}ms`);

    const totalTime = Date.now() - startTime;

    // Step 3: Save everything to database
    const updatedCall = await Call.findByIdAndUpdate(
      callId, 
      { 
        transcript,
        sentiment: analysis.sentiment,
        score: analysis.score,
        feedback: analysis.feedback,
        summary: analysis.summary,
        status: "analyzed"
      },
      { new: true }
    );

    return successResponse(
      res,
      {
        callId,
        transcript,
        analysis: {
          sentiment: analysis.sentiment,
          score: analysis.score,
          feedback: analysis.feedback,
          summary: analysis.summary
        },
        performance: {
          transcriptionTimeMs: transcriptionTime,
          analysisTimeMs: analysisTime,
          totalTimeMs: totalTime,
          transcriptLength: transcript.length,
          wordCount: transcript.split(' ').length
        },
        updatedCall
      },
      "Call transcribed and analyzed successfully"
    );

  } catch (error) {
    console.error("Complete analysis error:", error);
    
    // Update call status to failed if we have a callId
    const callId = req.params.callId || req.body.callId;
    if (callId) {
      await Call.findByIdAndUpdate(callId, { status: "failed" }).catch(console.error);
    }
    
    return errorResponse(res, error.message || "Failed to analyze call", 500);
  }
}

async function getAllUserCalls(req, res) {
  try {
    const userId = req.user?._id;
    
    if (!userId) {
      return validationErrorResponse(res, "User authentication failed");
    }

    // Get all calls for the user
    const calls = await Call.find({ userId })
      .sort({ createdAt: -1 }) // Most recent first
      .select('_id status transcript sentiment score feedback summary callNotes audioUrl s3Key createdAt updatedAt');

    return successResponse(
      res,
      {
        calls,
        totalCalls: calls.length,
        callsByStatus: {
          uploaded: calls.filter(call => call.status === 'uploaded').length,
          processing: calls.filter(call => call.status === 'processing').length,
          transcribed: calls.filter(call => call.status === 'transcribed').length,
          analyzed: calls.filter(call => call.status === 'analyzed').length,
          failed: calls.filter(call => call.status === 'failed').length,
        }
      },
      "User calls retrieved successfully"
    );

  } catch (error) {
    console.error("Get user calls error:", error);
    return errorResponse(res, error.message || "Failed to retrieve calls", 500);
  }
}

module.exports = {
  uploadCall,
  reanalyzeCall,
  downloadDecryptedAudio,
  testgpt,
  testTranscription,
  analyzeCallComplete,
  getAllUserCalls,
};
