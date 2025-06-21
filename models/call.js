// Call model: stores S3 URL, userId, transcript, sentiment, and call metrics
const mongoose = require('mongoose');

const callSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  audioUrl: { type: String }, // S3 bucket link
  transcript: { type: String },
  sentiment: { type: String },
  score: { type: Number }, // Metrics from Whisper/GPT
  feedback: { type: String },
  // Add more fields as needed for gamification/analytics
}, { timestamps: true });

module.exports = mongoose.model('Call', callSchema);
