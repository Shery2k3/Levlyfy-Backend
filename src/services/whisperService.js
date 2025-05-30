const fs = require("fs");
const path = require("path");
const { OpenAI } = require("openai");
require("dotenv").config();
const { decryptFile } = require("../utils/fileEncryption"); // import this

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Transcribes audio with retry logic
 * @param {string} encryptedAudioPath - Path to encrypted audio file
 * @param {number} maxRetries
 * @returns {Promise<string>} - transcription text
 */
const transcribeAudio = async (encryptedAudioPath, maxRetries = 3) => {
  if (!encryptedAudioPath) throw new Error("Audio path is required");

  const tempDir = path.resolve("temp");
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

  const decryptedPath = path.resolve(
    "temp",
    `dec-${Date.now()}-${path.basename(encryptedAudioPath)}`
  );

  try {
    await decryptFile(encryptedAudioPath, decryptedPath);
    console.log("✅ Decryption complete:", decryptedPath);
  } catch (err) {
    console.error("❌ Decrypt error:", err);
    throw new Error("Could not decrypt audio file");
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🎙️ Transcription attempt ${attempt} → ${decryptedPath}`);

      const audioStream = fs.createReadStream(decryptedPath);

      const transcription = await openai.audio.transcriptions.create({
        file: audioStream,
        model: "whisper-1",
        language: "en",
      });

      fs.unlinkSync(decryptedPath);

      return transcription.text;
    } catch (error) {
      console.error(`⚠️ Whisper API error (attempt ${attempt}):`, error.message);
      if (attempt < maxRetries) {
        const wait = 2000 * attempt;
        console.log(`⏳ Retrying in ${wait}ms...`);
        await sleep(wait);
      } else {
        fs.existsSync(decryptedPath) && fs.unlinkSync(decryptedPath);
        throw new Error("All transcription attempts failed");
      }
    }
  }
};

module.exports = {
  transcribeAudio,
};
