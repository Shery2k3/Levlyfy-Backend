const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middleware/auth.middleware");
const { twilioWebhookMiddleware } = require("../middleware/twilio.middleware");
const { 
  getToken, 
  voice, 
  startCall, 
  joinConference, 
  handleConferenceJoin,
  waitMusic 
} = require("../controllers/twillioController.js");

// Token endpoint needs auth (user requesting token)
router.get("/token", authMiddleware, getToken);

// Voice webhook does NOT need auth (Twilio calling it)
router.all("/voice", twilioWebhookMiddleware, voice);

// Conference join webhook
router.all("/join-conference", handleConferenceJoin);

// Wait music for conference
router.all("/wait-music", waitMusic);

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
  console.log("🏟️ Participant:", req.body.CallSid);
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

// Start call needs auth (user initiating call)
router.post("/start-call", authMiddleware, startCall);

// Join conference needs auth (user joining conference)
router.post("/join-conference", authMiddleware, joinConference);

// Test endpoints for debugging
router.all("/webhook-test", twilioWebhookMiddleware, (req, res) => {
  console.log("🔗 WEBHOOK CONNECTIVITY TEST!");
  console.log("Method:", req.method);
  console.log("Query:", req.query);
  console.log("Body:", req.body);
  res.type("text/xml");
  res.send('<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice">Webhook connectivity test successful! Your ngrok tunnel is working.</Say><Pause length="2"/><Hangup/></Response>');
});

// Simple test endpoint that doesn't require TwiML
router.get("/test-simple", twilioWebhookMiddleware, (req, res) => {
  console.log("🧪 SIMPLE TEST ENDPOINT HIT!");
  console.log("Query:", req.query);
  res.json({ success: true, message: "Endpoint working!", timestamp: new Date().toISOString() });
});

module.exports = router;
