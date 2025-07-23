const mongoose = require("mongoose");

const callSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    audioUrl: { type: String },
    s3Key: { type: String },
    transcript: { type: String },
    sentiment: { type: String },
    score: { type: Number },
    feedback: { type: String },
    summary: { type: String },
    callNotes: { type: String },
    status: {
      type: String,
      enum: ["uploaded", "processing", "transcribed", "analyzed", "failed"],
      default: "uploaded",
    },
    errorMessage: { type: String },

    // New fields for Twilio integration
    source: {
      type: String,
      enum: ["manual-upload", "twilio-recording"],
      default: "manual-upload",
    },
    twilioCallSid: { type: String },
    twilioRecordingSid: { type: String },

    // Existing fields
    dealClosed: { type: Boolean, default: false },
    upsell: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Call", callSchema);
