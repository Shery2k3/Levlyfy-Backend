const { S3Client } = require('@aws-sdk/client-s3');
const multer = require('multer');
const multerS3 = require('multer-s3');
const path = require('path');
require('dotenv').config();

/**
 * AWS S3 Upload Middleware
 * Handles direct file uploads to S3 bucket
 */

// Configure S3 Client
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Validate required environment variables
const validateS3Config = () => {
  const requiredVars = [
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY', 
    'AWS_S3_BUCKET',
    'AWS_REGION'
  ];
  
  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required S3 environment variables: ${missing.join(', ')}`);
  }
};

// Validate config on module load
validateS3Config();

// S3 Storage Configuration
const s3Storage = multerS3({
  s3: s3Client,
  bucket: process.env.AWS_S3_BUCKET,
  acl: 'private', // Keep files private for security
  contentType: multerS3.AUTO_CONTENT_TYPE,
  
  // Generate unique file key for S3
  key: function (req, file, cb) {
    const timestamp = Date.now();
    const sanitizedFilename = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const uniqueKey = `call-recordings/${timestamp}-${sanitizedFilename}`;
    
    console.log(`🚀 Uploading to S3: ${uniqueKey}`);
    cb(null, uniqueKey);
  },
  
  // Set metadata
  metadata: function (req, file, cb) {
    cb(null, {
      uploadedBy: 'levlyfy-backend',
      uploadDate: new Date().toISOString(),
      originalName: file.originalname,
      fileType: 'call-recording'
    });
  }
});

// File filter for audio files only
const fileFilter = (req, file, cb) => {
  console.log(`📁 Validating file: ${file.originalname} (${file.mimetype})`);
  
  // Check file extension
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExtensions = ['.mp3', '.wav', '.m4a', '.mp4', '.ogg'];
  
  // Check MIME type
  const allowedMimeTypes = [
    'audio/mpeg',
    'audio/mp3', 
    'audio/wav',
    'audio/mp4',
    'audio/ogg',
    'video/mp4' // Some audio files might have video container
  ];
  
  if (allowedExtensions.includes(ext) && allowedMimeTypes.includes(file.mimetype)) {
    console.log(`✅ File accepted: ${file.originalname}`);
    cb(null, true);
  } else {
    console.log(`❌ File rejected: ${file.originalname} (${file.mimetype})`);
    cb(new Error(`Invalid file type. Allowed: ${allowedExtensions.join(', ')}`), false);
  }
};

// Multer configuration with S3 storage
const uploadToS3 = multer({
  storage: s3Storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB limit
    files: 1 // Only one file at a time
  }
});

// Error handling middleware for S3 uploads
const handleS3UploadError = (error, req, res, next) => {
  console.error('❌ S3 Upload Error:', error);
  
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        success: false,
        error: 'File too large. Maximum size is 25MB.',
        code: 'FILE_TOO_LARGE'
      });
    }
    
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        error: 'Too many files. Upload one file at a time.',
        code: 'TOO_MANY_FILES'
      });
    }
  }
  
  if (error.message.includes('Invalid file type')) {
    return res.status(400).json({
      success: false,
      error: error.message,
      code: 'INVALID_FILE_TYPE'
    });
  }
  
  // Generic S3 upload error
  return res.status(500).json({
    success: false,
    error: 'Failed to upload file to cloud storage.',
    code: 'S3_UPLOAD_ERROR'
  });
};

// Success logger middleware
const logS3Upload = (req, res, next) => {
  if (req.file) {
    console.log(`✅ S3 Upload Successful:`);
    console.log(`   📍 Location: ${req.file.location}`);
    console.log(`   🔑 Key: ${req.file.key}`);
    console.log(`   📏 Size: ${(req.file.size / 1024 / 1024).toFixed(2)}MB`);
    console.log(`   🏷️  ETag: ${req.file.etag}`);
  }
  next();
};

module.exports = {
  uploadToS3,
  handleS3UploadError,
  logS3Upload,
  s3Client
};
