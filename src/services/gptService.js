const { OpenAI } = require("openai");
require("dotenv").config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Analyze call transcript using OpenAI GPT
 * @param {string} transcript - The call transcript text
 * @returns {Promise<Object>} - Analysis results
 */
const analyzeCall = async (transcript) => {
  if (!transcript || transcript.trim() === "") {
    throw new Error("Empty transcript provided for analysis");
  }

  try {
    const systemPrompt = `You are a CRM performance coach AI that analyzes call transcripts.
Your task is to provide a balanced assessment that helps the agent improve.
Always return valid JSON with the following structure:
{
  "sentiment": "Positive|Negative|Neutral",
  "feedback": "2-3 sentences of actionable feedback",
  "summary": "Brief summary of the call",
  "score": A number between 0 and 100
}`;

    const userPrompt = `Analyze this call transcript and provide feedback:
"${transcript.slice(0, 15000)}"`; // Limit to avoid token limits

    const response = await openai.chat.completions.create({
      model: "gpt-4", // Consider using a more reliable model like "gpt-4-turbo" if available
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.5, // Lower temperature for more consistent results
      max_tokens: 1000,
    });

    const content = response.choices[0].message.content;

    // Ensure we can parse the response as JSON
    let analysis;
    try {
      analysis = JSON.parse(content);
    } catch (parseError) {
      console.error("Failed to parse GPT response as JSON:", content);
      throw new Error("Invalid JSON response from GPT");
    }

    // Validate essential fields
    if (
      !analysis.sentiment ||
      !analysis.feedback ||
      !analysis.summary ||
      analysis.score === undefined
    ) {
      console.error("Incomplete analysis from GPT:", analysis);
      throw new Error("GPT analysis missing required fields");
    }

    // Ensure score is a number
    analysis.score = Number(analysis.score);
    if (isNaN(analysis.score)) {
      analysis.score = 50; // Default to middle value if invalid
    }

    console.log("Analysis complete:", JSON.stringify(analysis, null, 2));
    return analysis;
  } catch (error) {
    console.error("GPT analysis error:", error);
    throw error;
  }
};

module.exports = { analyzeCall };
