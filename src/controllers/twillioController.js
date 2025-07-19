const twilio = require("twilio");
const VoiceResponse = twilio.twiml.VoiceResponse;

const generateAccessToken = require("../utils/generateAccessToken.js");

const getToken = (req, res) => {
  console.log("🎫 TOKEN REQUEST RECEIVED!");
  console.log("👤 Decoded User:", req.user);
  
  const identity = req.user._id;
  console.log("👤 User Identity for token:", identity);

  if (!identity) {
    console.error("❌ NO IDENTITY! Token request failed");
    return res.status(400).json({ error: "Identity is required" });
  }

  console.log("🔐 Generating access token...");
  const token = generateAccessToken(identity);
  console.log("✅ Token generated successfully for identity:", identity);
  console.log("🎫 Token preview (first 50 chars):", token.substring(0, 50) + "...");
  
  res.json({ token });
};

const voice = (req, res) => {
  console.log("🔊 VOICE WEBHOOK CALLED!");
  console.log("📋 Request Query Params:", req.query);
  console.log("📋 Request Body:", req.body);
  console.log("📋 Request Headers:", req.headers);
  
  // The 'To' parameter in this request is the phone number you are calling.
  // The 'From' parameter is your Twilio number.
  console.log("📞 To (phone number):", req.body.To || req.query.To);
  console.log("📞 From (Twilio number):", req.body.From || req.query.From);
  console.log("📞 Call SID:", req.body.CallSid || req.query.CallSid);

  const VoiceResponse = twilio.twiml.VoiceResponse;
  const twiml = new VoiceResponse();

  // The identity of the user who initiated the call,
  // assuming you can pass it in the URL query params from startCall
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
    
    // Now dial the client (browser) to bridge the call
    const dial = twiml.dial({ 
      timeout: 30,
      record: false,
      action: `${process.env.BASE_URL}/api/twillio/dial-status?identity=${identity}`,
      method: 'POST'
    });

    // This will dial the client in your frontend app
    dial.client(identity); 
    console.log("📱 Dialing browser client with identity:", identity);
    
    // If the browser client doesn't answer, play a message
    twiml.say({ voice: 'alice' }, 'The agent is not available. Please try again later.');
  }

  const twimlString = twiml.toString();
  console.log("📜 Generated TwiML Response:");
  console.log(twimlString);

  res.type("text/xml");
  res.send(twimlString);
  
  console.log("✅ TwiML response sent successfully");
};


const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const startCall = async (req, res) => {
  console.log("🚀 START CALL INITIATED!");
  console.log("📋 Request Body:", req.body);
  console.log("👤 Authenticated User:", req.user);
  
  const { to } = req.body;
  const identity = req.user._id; // Assuming auth middleware provides the user
  
  console.log("📞 Calling number:", to);
  console.log("👤 User Identity:", identity);
  console.log("🌐 Base URL:", process.env.BASE_URL);
  
  const webhookUrl = `${process.env.BASE_URL}/api/twillio/twilio-test?identity=${identity}`;
  console.log("🔗 Webhook URL that will be called:", webhookUrl);

  try {
    console.log("📡 Making Twilio API call...");
    const call = await client.calls.create({
      to, // e.g. '+92300xxxxxxx'
      from: process.env.TWILIO_VERIFIED_CALLER_ID,
      // Pass the user's identity to the voice URL
      url: webhookUrl,
      method: 'POST',
      // Add timeout for faster debugging
      timeout: 60,
      // Status callbacks to track webhook calls
      statusCallback: `${process.env.BASE_URL}/api/twillio/status`,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed']
    });

    console.log("✅ Twilio call created successfully!");
    console.log("📞 Call SID:", call.sid);
    console.log("📞 Call Status:", call.status);

    res.status(200).json({ success: true, sid: call.sid, webhookUrl });
  } catch (error) {
    console.error("❌ Twilio Call Error:", error);
    console.error("❌ Error Details:", {
      message: error.message,
      code: error.code,
      moreInfo: error.moreInfo,
      status: error.status
    });
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = { getToken, voice, startCall };
