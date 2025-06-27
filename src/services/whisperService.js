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
 * Generate a pre-signed URL for S3 object (for Whisper API direct access)
 * @param {string} s3Key - S3 object key
 * @param {number} expiresIn - URL expiration time in seconds (default: 1 hour)
 * @returns {Promise<string>} - Pre-signed URL
 */
const generatePresignedUrl = async (s3Key, expiresIn = 3600) => {
  try {
    const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
    
    const command = new GetObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: s3Key,
    });

    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn });
    console.log(`🔗 Generated pre-signed URL for: ${s3Key}`);
    return presignedUrl;
  } catch (error) {
    console.error("❌ Pre-signed URL generation error:", error);
    throw new Error(`Failed to generate pre-signed URL: ${error.message}`);
  }
};

/**
 * Transcribes audio with optimized approach - tries URL first, falls back to download
 * @param {string} audioSource - S3 key, S3 URL, or local file path
 * @param {boolean} isS3Key - Whether audioSource is an S3 key
 * @param {number} maxRetries
 * @returns {Promise<string>} - transcription text
 */
const transcribeAudio = async (audioSource, isS3Key = true, maxRetries = 3) => {
  if (!audioSource) throw new Error("Audio source is required");

  try {
    // Strategy 1: Try using pre-signed URL first (faster, no download needed)
    if (isS3Key) {
      console.log(`🚀 Attempting direct URL transcription for S3 key: ${audioSource}`);
      
      try {
        const presignedUrl = await generatePresignedUrl(audioSource);
        
        const startTime = Date.now();
        const transcription = await openai.audio.transcriptions.create({
          file: presignedUrl,
          model: "whisper-1",
          // language: "en", // Remove this line if you want auto-detection
          response_format: "text",
        });
        
        const processingTime = Date.now() - startTime;
        console.log(`⚡ Direct URL transcription completed in ${processingTime}ms`);
        console.log(`✅ Transcription successful (${transcription.length} characters)`);
        
        return transcription;
      } catch (urlError) {
        console.warn(`⚠️ Direct URL transcription failed: ${urlError.message}`);
        console.log(`📥 Falling back to download method...`);
      }
    }

    // Strategy 2: Fallback to download method
    return await transcribeWithDownload(audioSource, isS3Key, maxRetries);

  } catch (error) {
    throw new Error(`Transcription failed: ${error.message}`);
  }
};

/**
 * Transcribe audio by downloading file first (fallback method)
 * @param {string} audioSource - S3 key or local file path
 * @param {boolean} isS3Key - Whether audioSource is an S3 key
 * @param {number} maxRetries
 * @returns {Promise<string>} - transcription text
 */
const transcribeWithDownload = async (audioSource, isS3Key = true, maxRetries = 3) => {
  let localFilePath;
  let shouldCleanup = false;

  try {
    // Download from S3 if needed
    if (isS3Key) {
      console.log(`📥 Downloading from S3: ${audioSource}`);
      localFilePath = await downloadFromS3(audioSource);
      shouldCleanup = true;
    } else {
      localFilePath = audioSource;
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
          // language: "en", // Remove this if you want auto-detection
          response_format: "text", // Get plain text instead of JSON
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
    throw error;
  }
};

module.exports = {
  transcribeAudio,
  downloadFromS3,
  generatePresignedUrl,
};
