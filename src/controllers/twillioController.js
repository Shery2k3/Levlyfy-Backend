const twilio = require("twilio");
const VoiceResponse = twilio.twiml.VoiceResponse;

const generateAccessToken = require("../utils/generateAccessToken.js");

const getToken = (req, res) => {
  const identity = req.user._id;
  console.log("Decoded User: ", req.user);
  console.log("user", req.user);

  if (!identity) {
    return res.status(400).json({ error: "Identity is required" });
  }

  const token = generateAccessToken(identity);
  res.json({ token });
};

const voice = (req, res) => {
  // The 'To' parameter in this request is the phone number you are calling.
  // The 'From' parameter is your Twilio number.
  // We are not using them here.

  const VoiceResponse = twilio.twiml.VoiceResponse;
  const twiml = new VoiceResponse();

  // The identity of the user who initiated the call,
  // assuming you can pass it in the URL query params from startCall
  // For example: /api/twillio/voice?identity=user123
  const identity = req.query.identity; 

  const dial = twiml.dial({ callerId: process.env.TWILIO_VERIFIED_CALLER_ID });

  // This will dial the client in your frontend app
  dial.client(identity); 

  res.type("text/xml");
  res.send(twiml.toString());
};


const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const startCall = async (req, res) => {
  const { to } = req.body;
  const identity = req.user._id; // Assuming auth middleware provides the user

  try {
    const call = await client.calls.create({
      to, // e.g. '+92300xxxxxxx'
      from: process.env.TWILIO_VERIFIED_CALLER_ID,
      // Pass the user's identity to the voice URL
      url: `https://6ed6466cdde3.ngrok-free.app/api/twillio/voice?identity=${identity}`, 
    });

    res.status(200).json({ success: true, sid: call.sid });
  } catch (error) {
    console.error("Twilio Call Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = { getToken, voice, startCall };
