const express = require("express");
const router = express.Router();
const twilio = require("twilio");
const { authMiddleware } = require("../middleware/auth.middleware");
const { getToken, voice, startCall } = require("../controllers/twillioController.js");

// Token endpoint needs auth (user requesting token)
router.get("/token", authMiddleware, getToken);

// Voice webhook does NOT need auth (Twilio calling it) - Accept ALL methods for debugging
router.all("/voice", (req, res) => {
  console.log("🔊 VOICE WEBHOOK CALLED!");
  console.log("🔊 Method:", req.method);
  console.log("🔊 URL:", req.url);
  console.log("🔊 Original URL:", req.originalUrl);
  console.log("📋 Request Query Params:", req.query);
  console.log("📋 Request Body:", req.body);
  console.log("📋 Request Headers:", req.headers);
  
  // The 'To' parameter in this request is the phone number you are calling.
  // The 'From' parameter is your Twilio number.
  console.log("📞 To (phone number):", req.body?.To || req.query?.To || "NOT PROVIDED");
  console.log("📞 From (Twilio number):", req.body?.From || req.query?.From || "NOT PROVIDED");
  console.log("📞 Call SID:", req.body?.CallSid || req.query?.CallSid || "NOT PROVIDED");

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
});

// Status callback endpoint to track call progress
router.all("/status", (req, res) => {
  console.log("📊 CALL STATUS CALLBACK!");
  console.log("📊 Call SID:", req.body.CallSid || req.query.CallSid);
  console.log("📊 Call Status:", req.body.CallStatus || req.query.CallStatus);
  console.log("📊 Direction:", req.body.Direction || req.query.Direction);
  console.log("📊 All Data:", req.body);
  res.status(200).send("OK");
});

// Conference status callback endpoint
router.all("/conference-status", (req, res) => {
  console.log("🏟️ CONFERENCE STATUS CALLBACK!");
  console.log("🏟️ Conference Name:", req.body.ConferenceSid || req.query.ConferenceSid);
  console.log("🏟️ Status Event:", req.body.StatusCallbackEvent || req.query.StatusCallbackEvent);
  console.log("🏟️ All Data:", req.body);
  res.status(200).send("OK");
});

// Dial status callback endpoint
router.all("/dial-status", (req, res) => {
  console.log("☎️ DIAL STATUS CALLBACK!");
  console.log("☎️ Dial Call Status:", req.body.DialCallStatus || req.query.DialCallStatus);
  console.log("☎️ Identity:", req.query.identity);
  console.log("☎️ All Data:", req.body);
  res.status(200).send("OK");
});

// Test endpoint to see what Twilio is sending
router.all("/voice-test", (req, res) => {
  console.log("🧪 VOICE TEST ENDPOINT HIT!");
  console.log("Method:", req.method);
  console.log("Headers:", req.headers);
  console.log("Query:", req.query);
  console.log("Body:", req.body);
  res.type("text/xml");
  res.send('<?xml version="1.0" encoding="UTF-8"?><Response><Say>Test successful</Say></Response>');
});

// Add a simple webhook connectivity test
router.all("/webhook-test", (req, res) => {
  console.log("🔗 WEBHOOK CONNECTIVITY TEST!");
  console.log("Method:", req.method);
  console.log("Query:", req.query);
  console.log("Body:", req.body);
  res.type("text/xml");
  res.send('<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice">Webhook connectivity test successful! Your ngrok tunnel is working.</Say><Pause length="2"/><Hangup/></Response>');
});

// TEMPORARY: Test endpoint that Twilio will definitely call
router.all("/twilio-test", (req, res) => {
  console.log("🧪 TWILIO TEST ENDPOINT CALLED!");
  console.log("🧪 Method:", req.method);
  console.log("🧪 URL:", req.url);
  console.log("🧪 Headers:", req.headers);
  console.log("🧪 Body:", req.body);
  console.log("🧪 Query:", req.query);
  
  res.type("text/xml");
  res.send('<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice">Twilio test endpoint reached successfully! Now we know webhooks work.</Say><Pause length="3"/><Hangup/></Response>');
});

// Start call needs auth (user initiating call)
router.post("/start-call", authMiddleware, startCall);

module.exports = router;
