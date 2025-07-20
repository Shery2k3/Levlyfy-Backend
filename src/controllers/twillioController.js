const twilio = require("twilio");
const VoiceResponse = twilio.twiml.VoiceResponse;
const generateAccessToken = require("../utils/generateAccessToken.js");
const { successResponse, errorResponse } = require("../utils/response");

const getToken = (req, res) => {
  console.log("🎫 TOKEN REQUEST RECEIVED!");
  console.log("👤 Decoded User:", req.user);
  
  const identity = req.user._id.toString(); // Ensure it's a string
  console.log("👤 User Identity for token:", identity);

  if (!identity) {
    console.error("❌ NO IDENTITY! Token request failed");
    return errorResponse(res, "Identity is required", 400);
  }

  try {
    console.log("🔐 Generating access token...");
    const token = generateAccessToken(identity);
    console.log("✅ Token generated successfully for identity:", identity);
    console.log("🎫 Token preview (first 50 chars):", token.substring(0, 50) + "...");
    
    return successResponse(res, { token, identity }, "Token generated successfully");
  } catch (error) {
    console.error("❌ Error generating token:", error);
    return errorResponse(res, "Failed to generate token", 500);
  }
};

const voice = (req, res) => {
  console.log("🔊 VOICE WEBHOOK CALLED!");
  console.log("📋 Request Method:", req.method);
  console.log("📋 Request Query Params:", req.query);
  console.log("📋 Request Body:", req.body);
  console.log("📋 Request Headers:", req.headers);
  
  // The 'To' parameter in this request is the phone number you are calling.
  // The 'From' parameter is your Twilio number.
  console.log("📞 To (phone number):", req.body.To || req.query.To);
  console.log("📞 From (Twilio number):", req.body.From || req.query.From);
  console.log("📞 Call SID:", req.body.CallSid || req.query.CallSid);
  console.log("📞 Call Status:", req.body.CallStatus || req.query.CallStatus);

  const twiml = new VoiceResponse();

  // The identity of the user who initiated the call
  const identity = req.query.identity; 
  console.log("👤 User Identity from query:", identity);

  if (!identity) {
    console.error("❌ NO IDENTITY PROVIDED! This will cause the call to fail!");
    twiml.say({ voice: 'alice' }, 'Error: No user identity provided. Call will end.');
    twiml.hangup();
  } else {
    // When Twilio calls the webhook, the external phone number is already connected
    // We need to now connect this to the browser client
    console.log("✅ External phone answered, now connecting to browser client:", identity);
    
    // Add a small pause to ensure clean audio
    twiml.pause({ length: 1 });
    
    // Create a conference room for the call
    const conferenceName = `call-${identity}-${Date.now()}`;
    
    // Join the conference and wait for the client to join
    twiml.dial({ 
      timeout: 30,
      record: false,
      action: `${process.env.SERVER_BASE_URL}/api/twilio/dial-status?identity=${identity}`,
      method: 'POST'
    }).conference(conferenceName, {
      startConferenceOnEnter: true,
      endConferenceOnExit: true,
      waitUrl: `${process.env.SERVER_BASE_URL}/api/twilio/wait-music`,
      statusCallback: `${process.env.SERVER_BASE_URL}/api/twilio/conference-status`,
      statusCallbackEvent: ['start', 'end', 'join', 'leave']
    });
    
    console.log("🏟️ Conference room created:", conferenceName);
  }

  const twimlString = twiml.toString();
  console.log("📜 Generated TwiML Response:");
  console.log(twimlString);

  res.type("text/xml");
  res.send(twimlString);
  
  console.log("✅ TwiML response sent successfully");
};

// Initialize Twilio client
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const startCall = async (req, res) => {
  console.log("🚀 START CALL INITIATED!");
  console.log("📋 Request Body:", req.body);
  console.log("👤 Authenticated User:", req.user);
  
  const { to } = req.body;
  const identity = req.user._id.toString();
  
  if (!to) {
    return errorResponse(res, "Phone number (to) is required", 400);
  }
  
  console.log("📞 Calling number:", to);
  console.log("👤 User Identity:", identity);
  console.log("🌐 Base URL:", process.env.SERVER_BASE_URL);
  
  const webhookUrl = `${process.env.SERVER_BASE_URL}/api/twilio/voice?identity=${identity}`;
  console.log("🔗 Webhook URL that will be called:", webhookUrl);

  try {
    console.log("📡 Making Twilio API call...");
    console.log("🔗 Full webhook URL that Twilio will call:", webhookUrl);
    
    // Test if our webhook URL is accessible first
    const webhookTestUrl = `${process.env.SERVER_BASE_URL}/api/twilio/test-simple?test=1`;
    console.log("🧪 Testing webhook accessibility:", webhookTestUrl);
    
    const call = await client.calls.create({
      to,
      from: process.env.TWILIO_PHONE_NUMBER,
      url: webhookUrl,
      method: 'POST',
      timeout: 60,
      statusCallback: `${process.env.SERVER_BASE_URL}/api/twilio/status`,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      statusCallbackMethod: 'POST'
    });

    console.log("✅ Twilio call created successfully!");
    console.log("📞 Call SID:", call.sid);
    console.log("📞 Call Status:", call.status);
    console.log("🔗 Webhook URL that was sent to Twilio:", webhookUrl);

    return successResponse(res, { 
      callSid: call.sid, 
      status: call.status, 
      webhookUrl,
      testUrl: webhookTestUrl 
    }, "Call initiated successfully");
  } catch (error) {
    console.error("❌ Twilio Call Error:", error);
    console.error("❌ Error Details:", {
      message: error.message,
      code: error.code,
      moreInfo: error.moreInfo,
      status: error.status
    });
    return errorResponse(res, error.message || "Failed to initiate call", 500);
  }
};

// Join conference call (for browser client)
const joinConference = async (req, res) => {
  console.log("🏟️ JOIN CONFERENCE INITIATED!");
  const { conferenceName } = req.body;
  const identity = req.user._id.toString();

  if (!conferenceName) {
    return errorResponse(res, "Conference name is required", 400);
  }

  try {
    const call = await client.calls.create({
      to: `client:${identity}`,
      from: process.env.TWILIO_PHONE_NUMBER,
      url: `${process.env.SERVER_BASE_URL}/api/twilio/join-conference?conferenceName=${conferenceName}&identity=${identity}`,
      method: 'POST'
    });

    console.log("✅ Conference join call created:", call.sid);
    return successResponse(res, { callSid: call.sid, conferenceName }, "Joined conference successfully");
  } catch (error) {
    console.error("❌ Conference join error:", error);
    return errorResponse(res, error.message || "Failed to join conference", 500);
  }
};

// Handle conference join TwiML
const handleConferenceJoin = (req, res) => {
  const { conferenceName, identity } = req.query;
  console.log("🏟️ HANDLING CONFERENCE JOIN for:", identity);

  const twiml = new VoiceResponse();
  twiml.dial().conference(conferenceName, {
    startConferenceOnEnter: false,
    endConferenceOnExit: false
  });

  res.type("text/xml");
  res.send(twiml.toString());
};

// Wait music for conference
const waitMusic = (req, res) => {
  console.log("🎵 PLAYING WAIT MUSIC");
  const twiml = new VoiceResponse();
  twiml.play('https://demo.twilio.com/docs/classic.mp3');
  
  res.type("text/xml");
  res.send(twiml.toString());
};

module.exports = { 
  getToken, 
  voice, 
  startCall, 
  joinConference, 
  handleConferenceJoin,
  waitMusic 
};
