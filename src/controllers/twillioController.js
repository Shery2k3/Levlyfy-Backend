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
  const to = req.body.to; // match key in your frontend payload

  const VoiceResponse = twilio.twiml.VoiceResponse;
  const twiml = new VoiceResponse();
  const dial = twiml.dial({ callerId: process.env.TWILIO_VERIFIED_CALLER_ID });

  dial.number(to); // 🔁 Dials a real phone number, not a client identity

  res.type("text/xml");
  res.send(twiml.toString());
};


const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const startCall = async (req, res) => {
  const { to } = req.body;

  try {
    const call = await client.calls.create({
      to, // e.g. '+92300xxxxxxx'
      from: process.env.TWILIO_VERIFIED_CALLER_ID,
      url: "https://6ed6466cdde3.ngrok-free.app/api/twillio/voice", // Twilio calls this route
    });

    res.status(200).json({ success: true, sid: call.sid });
  } catch (error) {
    console.error("Twilio Call Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = { getToken, voice, startCall };
