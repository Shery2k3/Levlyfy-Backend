const Twilio = require("twilio");
const axios = require("axios");
const FormData = require("form-data");
const TwilioCall = require("../../models/twilioCall.js");

async function generateAccessToken(req, res) {
  const identity = "agent_" + req.user._id.toString();

  const AccessToken = Twilio.jwt.AccessToken;
  const VoiceGrant = AccessToken.VoiceGrant;

  const accessToken = new AccessToken(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_API_SID,
    process.env.TWILIO_API_SECRET,
    { identity }
  );

  const voiceGrant = new VoiceGrant({
    outgoingApplicationSid: process.env.TWILIO_TWIML_APP_SID,
    incomingAllow: false,
  });

  accessToken.addGrant(voiceGrant);
  const token = accessToken.toJwt();

  //? Send the token back to the client
  console.log("✅ Generated Twilio Access Token for:", identity);
  return res.status(200).json({ token, identity });
}

async function voice(req, res) {
  console.log("📞 VOICE WEBHOOK RECEIVED!");
  console.log("📞 Request body:", req.body);
  console.log("📞 Request headers:", req.headers);

  const phoneNumberToDial = req.body.To || req.query.To;
  const callerId = process.env.TWILIO_PHONE_NUMBER;
  const callSid = req.body.CallSid; // Extract CallSid from webhook
  const from = req.body.From; // This contains the identity

  console.log("📞 CallSid from webhook:", callSid);
  console.log("📞 From (identity):", from);

  // Extract userId from the 'From' parameter (which contains the identity)
  if (callSid && from) {
    try {
      // Extract userId from identity like "client:agent_USER_ID"
      const identityMatch = from.match(/agent_([a-f0-9]{24})/);
      if (identityMatch) {
        const userId = identityMatch[1];
        console.log(`📞 Extracted userId: ${userId} from identity: ${from}`);
        
        // Pre-create the call metadata
        const twilioCall = await TwilioCall.create({
          callSid,
          userId,
          phoneNumber: phoneNumberToDial,
          status: "in-progress",
        });
        
        console.log(`✅ Pre-created call metadata for CallSid: ${callSid}`);
      } else {
        console.log(`⚠️ Could not extract userId from identity: ${from}`);
      }
    } catch (error) {
      console.error("❌ Error pre-creating call metadata:", error);
    }
  }

  const twiml = new Twilio.twiml.VoiceResponse();

  const dial = twiml.dial({
    callerId,
    record: "record-from-answer",
    recordingStatusCallback: `${process.env.SERVER_BASE_URL}/api/twilio/recording-status`,
    recordingStatusCallbackEvent: "completed",
    callbackMethod: "POST",
  });

  if (phoneNumberToDial) {
    console.log("📞 Dialing phone number:", phoneNumberToDial);
    dial.number(phoneNumberToDial);
  } else {
    console.error("❌ No phone number provided to dial");
    twiml.say("No phone number provided to dial.");
  }
  
  res.type("text/xml");
  res.send(twiml.toString());
  console.log("Responding with TwiML:", twiml.toString());
}

async function recordingStatus(req, res) {
  console.log("🎙️ RECORDING STATUS WEBHOOK RECEIVED!");

  try {
    const {
      RecordingUrl,
      RecordingSid,
      CallSid,
      RecordingDuration,
      AccountSid,
    } = req.body;

    if (RecordingUrl) {
      console.log(`📹 Recording completed: ${RecordingUrl}`);
      console.log(`⏱️ Duration: ${RecordingDuration} seconds`);

      const twilioCall = await TwilioCall.findOne({
        callSid: CallSid,
      });

      if (!twilioCall) {
        console.error(`❌ No call metadata found for CallSid: ${CallSid}`);
        return res
          .status(200)
          .send("Call metadata not found, but acknowledged");
      }

      console.log(`✅ Found user ${twilioCall.userId} for CallSid ${CallSid}`);

      // Download the recording from Twilio
      await downloadAndProcessRecording(
        RecordingUrl,
        CallSid,
        RecordingSid,
        twilioCall.userId
      );
    }

    res.status(200).send("OK");
  } catch (error) {
    console.error("❌ Recording status error:", error);
    res.status(500).send("Error processing recording");
  }
}

function generateSystemToken(userId) {
  const jwt = require("jsonwebtoken");
  const jwtSecret = process.env.JWT_SECRET;

  const userIdString = userId.toString();

  return jwt.sign(
    {
      data: { _id: userIdString },
      system: true,
      purpose: "twilio-recording-upload",
    },
    jwtSecret,
    { expiresIn: "1h" }
  );
}

async function downloadAndProcessRecording(
  recordingUrl,
  callSid,
  recordingSid,
  userId
) {
  try {
    if (!userId) {
      console.error("❌ No userId provided for recording processing");
      return;
    }

    const audioUrl = recordingUrl + ".wav";

    console.log(`📥 Downloading recording from: ${audioUrl}`);

    // Download the audio file from Twilio
    const response = await axios({
      method: "GET",
      url: audioUrl,
      auth: {
        username: process.env.TWILIO_ACCOUNT_SID,
        password: process.env.TWILIO_AUTH_TOKEN,
      },
      responseType: "stream",
    });

    // Create form data for upload
    const formData = new FormData();
    formData.append("audio", response.data, {
      filename: `twilio-recording-${recordingSid}.wav`,
      contentType: "audio/wav",
    });

    formData.append(
      "callNotes",
      `Twilio recording - CallSid: ${callSid}, Duration: ${response.headers["content-length"]} bytes`
    );

    // Generate a system token for this upload
    const systemToken = generateSystemToken(userId);
    console.log(`🔑 Generated system token for user: ${userId}`);

    // Upload to your call processing endpoint
    const uploadResponse = await axios.post(
      `${process.env.SERVER_BASE_URL}/api/call/upload-call-recording`,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          Authorization: `Bearer ${systemToken}`,
          "X-Twilio-CallSid": callSid,
          "X-Twilio-RecordingSid": recordingSid,
        },
      }
    );

    console.log("✅ Recording uploaded successfully:", uploadResponse.data);

    // Update TwilioCall record
    await TwilioCall.findOneAndUpdate(
      { callSid: callSid },
      {
        recordingSid,
        recordingUrl: audioUrl,
        status: "recording-processed",
        callAnalysisId: uploadResponse.data.data.id, // Link to the Call document
      }
    );
  } catch (error) {
    console.error("❌ Failed to download/process recording:", error);
  }
}

async function callStarted(req, res) {
  try {
    const { callSid, phoneNumber } = req.body;
    const userId = req.user._id;

    console.log(`📞 Call-started received - CallSid: ${callSid}, User: ${userId}, Phone: ${phoneNumber}`);

    // Check if call metadata already exists (from voice webhook)
    let twilioCall = await TwilioCall.findOne({ callSid });
    
    if (twilioCall) {
      console.log(`✅ Found existing call metadata for CallSid: ${callSid}`);
      // Update the existing record if needed
      twilioCall.phoneNumber = phoneNumber;
      twilioCall.status = "in-progress";
      await twilioCall.save();
    } else {
      console.log(`🆕 Creating new call metadata for CallSid: ${callSid}`);
      // Create new record
      twilioCall = await TwilioCall.create({
        callSid,
        userId,
        phoneNumber,
        status: "in-progress",
      });
    }

    console.log(`📞 Call metadata confirmed - CallSid: ${callSid}, User: ${userId}`);
    res.status(200).json({ success: true, callId: twilioCall._id });
  } catch (error) {
    console.error("Error in callStarted:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = {
  generateAccessToken,
  voice,
  recordingStatus,
  callStarted,
};
