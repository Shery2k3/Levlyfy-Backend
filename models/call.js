// Call model: stores S3 URL, userId, transcript, sentiment, and call metrics
const mongoose = require('mongoose');

const callSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  audioUrl: { type: String }, // S3 public URL
  s3Key: { type: String }, // S3 object key for internal operations
  transcript: { type: String },
  sentiment: { type: String },
  score: { type: Number }, // Performance score from GPT analysis
  feedback: { type: String }, // Feedback from GPT analysis
  summary: { type: String }, // Call summary from GPT analysis
  callNotes: { type: String }, // User-provided notes about the call
  status: { 
    type: String, 
    enum: ['uploaded', 'processing', 'transcribed', 'analyzed', 'failed'], 
    default: 'uploaded' 
  },
  errorMessage: { type: String }, // Store error message if processing fails
  // Add more fields as needed for gamification/analytics
}, { timestamps: true });

module.exports = mongoose.model('Call', callSchema);
