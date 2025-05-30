const { transcribeAudio } = require("../services/whisperService");
const { analyzeCall } = require("../services/gptService");
const { Call, Performance } = require("../../models");
const path = require("path");
const fs = require("fs");
const { encryptFile, decryptFile } = require("../utils/fileEncryption");

// Helper function for waiting
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Process a call recording: transcribe, analyze, and save results
 * @param {Object} call - The call object from database
 * @param {Object} file - The uploaded file object
 */
const processCall = async (call, file) => {
  try {
    console.log(`📞 Processing Call ID ${call.id}`);
    console.log(`📁 File path: ${file.path}`);
    console.log(`📄 File name: ${file.originalname}`);

    // Ensure file exists and is valid
    if (!fs.existsSync(file.path)) {
      throw new Error(`File not found at ${file.path}`);
    }

    // Create encrypted file path with timestamp and original filename
    const encryptedFilePath = path.join(
      "uploads",
      `enc-${Date.now()}-${file.originalname}`
    );

    console.log(`🔐 Encrypting file to: ${encryptedFilePath}`);

    try {
      // Encrypt the file
      encryptFile(file.path, encryptedFilePath);
      
      // Remove original unencrypted file
      fs.unlinkSync(file.path);
      
      console.log("✅ File encrypted successfully");
    } catch (encryptError) {
      console.error("❌ Encryption failed:", encryptError);
      throw new Error(`File encryption failed: ${encryptError.message}`);
    }

    // Update call with encrypted file path and processing status
    await Call.update(
      {
        audioUrl: encryptedFilePath,
        status: "processing"
      },
      {
        where: { id: call.id },
      }
    );

    // Transcribe audio with retries built into the transcribeAudio function
    console.log("🎙️ Transcribing audio...");
    let transcript;
    try {
      transcript = await transcribeAudio(encryptedFilePath);
      console.log("✅ Transcription successful");
    } catch (transcriptError) {
      console.error("❌ Transcription failed after retries:", transcriptError);
      throw new Error(`Transcription failed: ${transcriptError.message}`);
    }

    // If transcript is empty or undefined, throw error
    if (!transcript || transcript.trim() === "") {
      throw new Error("Empty transcript returned from Whisper API");
    }

    // Analyze the transcript
    console.log("🧠 Analyzing call transcript...");


    let analysis = null;
    const maxRetries = 3;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔁 GPT analysis attempt ${attempt} for Call ID: ${call.id}`);
        analysis = await analyzeCall();
        console.log("✅ Analysis successful");
        break;
      } catch (err) {
        console.error(`❌ GPT Error on attempt ${attempt}:`, err.message);
        if (attempt < maxRetries) {
          const wait = 2000 * attempt; // Exponential backoff
          console.log(`⏱️ Retrying analysis in ${wait}ms...`);
          await sleep(wait);
        } else {
          throw new Error("GPT analysis failed after all retries");
        }
      }
    }

    // Update the call record with results
    await Call.update(
      {
        // transcript,
        sentiment: analysis?.sentiment || "Unknown",
        callFeedback: analysis?.feedback || "",
        callSummary: analysis?.summary || "",
        status: "complete",
      },
      {
        where: { id: call.id },
      }
    );

    // Create performance record
    if (analysis && analysis.score) {
      await Performance.create({
        userId: call.userId,
        score: analysis.score.toString(),
        feedback: analysis?.feedback || "",
      });
    }

    console.log(`✅ Successfully processed Call ID ${call.id}`);
  } catch (err) {
    console.error(`⛔ Final failure for Call ID ${call.id}:`, err.message);
    
    // Update call status to failed
    await Call.update(
      { 
        status: "failed",
        callNotes: `Processing failed: ${err.message}` 
      }, 
      { where: { id: call.id } }
    );
  }
};

module.exports = processCall;