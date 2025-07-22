const { Twilio } = require("twilio");

async function generateAccessToken(req, res) {
  const identity = "agent_" + req.user.id.toString();

  const AccessToken = Twilio.jwt.AccessToken;
  const VoiceGrant = AccessToken.VoiceGrant;

  const accessToken = new AccessToken(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_API_KEY,
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

  //? The number dialed by our client
  const phoneNumberToDial = req.body.To || req.query.To;

  //? The twilio number we own
  const callerId = process.env.TWILIO_PHONE_NUMBER;

  const twiml = new Twilio.twiml.VoiceResponse();

  const dial = twiml.dial({ callerId });

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

module.exports = {
  generateAccessToken,
  voice,
};
