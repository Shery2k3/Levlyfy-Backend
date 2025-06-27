const fs = require("fs");
const path = require("path");
const { OpenAI } = require("openai");
const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
require("dotenv").config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Configure S3 Client
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Download file from S3 to temporary location
 * @param {string} s3Key - S3 object key
 * @returns {Promise<string>} - Local file path
 */
const downloadFromS3 = async (s3Key) => {
  const tempDir = path.resolve("temp");
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  const localPath = path.join(
    tempDir,
    `download-${Date.now()}-${path.basename(s3Key)}`
  );

  try {
    const command = new GetObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: s3Key,
    });

    const response = await s3Client.send(command);
    const stream = response.Body;

    // Write stream to file
    const writeStream = fs.createWriteStream(localPath);

    return new Promise((resolve, reject) => {
      stream.pipe(writeStream);
      writeStream.on("finish", () => resolve(localPath));
      writeStream.on("error", reject);
    });
  } catch (error) {
    console.error("❌ S3 download error:", error);
    throw new Error(`Failed to download file from S3: ${error.message}`);
  }
};

/**
 * Transcribes audio from S3 HTTPS URL by downloading first
 * @param {string} audioSource - S3 HTTPS URL or local file path
 * @param {boolean} isUrl - Whether audioSource is a URL (true) or local file path (false)
 * @param {number} maxRetries
 * @returns {Promise<string>} - transcription text
 */
const transcribeAudio = async (audioSource, isUrl = true, maxRetries = 3) => {
  if (!audioSource) throw new Error("Audio source is required");

  let localFilePath;
  let shouldCleanup = false;

  try {
    // Download from S3 URL if needed
    if (isUrl && audioSource.startsWith('https://')) {
      console.log(`� Downloading from S3 URL: ${audioSource}`);
      // Extract S3 key from URL for download function
      const urlParts = audioSource.split('/');
      const s3Key = urlParts.slice(3).join('/'); // Everything after the domain
      localFilePath = await downloadFromS3(s3Key);
      shouldCleanup = true;
    } else {
      localFilePath = audioSource; // Assume it's already a local file path
    }

    // Verify file exists and has content
    if (!fs.existsSync(localFilePath)) {
      throw new Error(`File not found: ${localFilePath}`);
    }

    const fileStats = fs.statSync(localFilePath);
    if (fileStats.size === 0) {
      throw new Error("Audio file is empty");
    }

    console.log(
      `📁 File ready for transcription: ${localFilePath} (${(
        fileStats.size / 1024 / 1024
      ).toFixed(2)}MB)`
    );

    // Transcribe with retry logic
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🎙️ Transcription attempt ${attempt}/${maxRetries}`);

        const audioStream = fs.createReadStream(localFilePath);

        const transcription = await openai.audio.transcriptions.create({
          file: audioStream,
          model: "whisper-1",
          response_format: "text",
        });

        console.log(`✅ Transcription successful (${transcription.length} characters)`);

        // Clean up temporary file
        if (shouldCleanup) {
          fs.unlinkSync(localFilePath);
        }

        return transcription;
      } catch (error) {
        console.error(`⚠️ Whisper API error (attempt ${attempt}):`, error.message);

        if (attempt < maxRetries) {
          const wait = Math.min(2000 * attempt, 10000); // Cap at 10 seconds
          console.log(`⏳ Retrying in ${wait}ms...`);
          await sleep(wait);
        } else {
          throw error;
        }
      }
    }
  } catch (error) {
    // Clean up on error
    if (shouldCleanup && localFilePath && fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
    }
    throw new Error(`Transcription failed: ${error.message}`);
  }
};

module.exports = {
  transcribeAudio,
  downloadFromS3,
};
