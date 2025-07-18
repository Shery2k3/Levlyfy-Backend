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
  const to = req.body.To;

  const VoiceResponse = twilio.twiml.VoiceResponse;
  const twiml = new VoiceResponse();
  const dial = twiml.dial({ callerId: YOUR_VERIFIED_TWILIO_NUMBER });

  if (to.startsWith('+')) {
    dial.number(to); // real phone number
  } else {
    dial.client(to); // just in case
  }

  res.type('text/xml');
  res.send(twiml.toString());
};

module.exports = { getToken,voice };
