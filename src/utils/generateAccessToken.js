const twilio = require('twilio');
const AccessToken = twilio.jwt.AccessToken;
const VoiceGrant = AccessToken.VoiceGrant;

const generateAccessToken = (identity) => {
  console.log("🔐 Generating Twilio access token for identity:", identity);
  
  const accessToken = new AccessToken(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_API_SID,
    process.env.TWILIO_API_SECRET,
    {
      identity: identity
    }
  );

  // Create a Voice grant and add to the token
  const voiceGrant = new VoiceGrant({
    outgoingApplicationSid: process.env.TWILIO_TWIML_APP_SID,
    incomingAllow: true, // Allow incoming calls
  });

  accessToken.addGrant(voiceGrant);

  console.log("✅ Access token generated successfully");
  return accessToken.toJwt();
};

module.exports = generateAccessToken;
