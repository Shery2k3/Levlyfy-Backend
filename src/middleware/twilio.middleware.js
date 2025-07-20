const twilioWebhookMiddleware = (req, res, next) => {
  // Log all webhook requests for debugging
  console.log("🕸️ WEBHOOK MIDDLEWARE - Incoming request:");
  console.log("📋 Method:", req.method);
  console.log("📋 URL:", req.url);
  console.log("📋 User-Agent:", req.get('User-Agent'));
  console.log("📋 Content-Type:", req.get('Content-Type'));
  console.log("📋 Body:", req.body);
  console.log("📋 Query:", req.query);
  
  // Check if this looks like a Twilio webhook
  const userAgent = req.get('User-Agent') || '';
  const isTwilioRequest = userAgent.includes('TwilioProxy') || 
                         userAgent.includes('Twilio') ||
                         req.get('X-Twilio-Signature');
  
  if (isTwilioRequest) {
    console.log("🔔 DETECTED TWILIO WEBHOOK REQUEST!");
  }
  
  // Continue processing
  next();
};

module.exports = { twilioWebhookMiddleware };
