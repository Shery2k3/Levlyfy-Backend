const mongoose = require("mongoose");

const twilioCallSchema = new mongoose.Schema(
  {
    callSid: { type: String, required: true, unique: true },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    phoneNumber: { type: String, required: true },
    status: {
      type: String,
      enum: [
        "initiated",
        "in-progress",
        "completed",
        "failed",
        "recording-processed",
      ],
      default: "initiated",
    },
    recordingSid: { type: String },
    recordingUrl: { type: String },
    callAnalysisId: { type: mongoose.Schema.Types.ObjectId, ref: "Call" }, // Links to your Call model
    duration: { type: Number },
    startTime: { type: Date, default: Date.now },
    endTime: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model("TwilioCall", twilioCallSchema);
