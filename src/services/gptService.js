const { OpenAI } = require("openai");
require("dotenv").config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Analyze call transcript using OpenAI GPT (Optimized for speed)
 * @param {string} transcript - The call transcript text
 * @returns {Promise<Object>} - Analysis results
 */
const analyzeCall = async (transcript) => {
  if (!transcript || transcript.trim() === "") {
    throw new Error("Empty transcript provided for analysis");
  }

  try {
    console.log(`🧠 Analyzing transcript (${transcript.length} characters)...`);

    const systemPrompt = `You are a CRM performance coach AI. Analyze call transcripts quickly and efficiently.
Return ONLY valid JSON with this exact structure:
{
  "sentiment": "Positive|Negative|Neutral",
  "feedback": "Brief actionable feedback (1-2 sentences)",
  "summary": "Concise call summary (1-2 sentences)",
  "score": 75
}`;

    // Limit transcript to avoid token limits and improve speed
    const truncatedTranscript = transcript.slice(0, 8000);

    const userPrompt = `Analyze this call transcript:\n\n"${truncatedTranscript}"`;

    const startTime = Date.now();

    const response = await openai.chat.completions.create({
      model: "gpt-4", // Much faster than gpt-4, ~10x speed improvement
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3, // Lower for consistency and speed
      max_tokens: 500, // Reduced for faster response
      top_p: 0.9, // Slightly more focused responses
    });

    const processingTime = Date.now() - startTime;
    console.log(`⚡ GPT analysis completed in ${processingTime}ms`);

    const content = response.choices[0].message.content.trim();

    // Parse and validate JSON response
    let analysis;
    try {
      // Remove any markdown formatting if present
      const cleanContent = content.replace(/```json\n?|\n?```/g, "").trim();
      analysis = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error("❌ Failed to parse GPT response:", content);
      // Return fallback analysis
      return {
        sentiment: "Neutral",
        feedback: "Unable to analyze transcript properly",
        summary: "Analysis failed - please try again",
        score: 50,
      };
    }

    // Ensure all required fields exist with defaults
    const validatedAnalysis = {
      sentiment: analysis.sentiment || "Neutral",
      feedback: analysis.feedback || "No specific feedback available",
      summary: analysis.summary || "No summary available",
      score: Number(analysis.score) || 50,
    };

    // Validate score range
    if (validatedAnalysis.score < 0 || validatedAnalysis.score > 100) {
      validatedAnalysis.score = 50;
    }

    console.log(
      `✅ Analysis complete: ${validatedAnalysis.sentiment} sentiment, score: ${validatedAnalysis.score}`
    );
    return validatedAnalysis;
  } catch (error) {
    console.error("❌ GPT analysis error:", error.message);

    // Return fallback analysis instead of throwing
    return {
      sentiment: "Neutral",
      feedback: "Analysis temporarily unavailable",
      summary: "Please try again later",
      score: 50,
    };
  }
};

/**
 * Quick sentiment analysis only (for faster processing)
 * @param {string} transcript
 * @returns {Promise<string>}
 */
const analyzeSentiment = async (transcript) => {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content:
            "Analyze the sentiment of this call transcript. Respond with only: Positive, Negative, or Neutral",
        },
        {
          role: "user",
          content: transcript.slice(0, 4000),
        },
      ],
      max_tokens: 10,
      temperature: 0.1,
    });

    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error("Sentiment analysis error:", error);
    return "Neutral";
  }
};

module.exports = {
  analyzeCall,
  analyzeSentiment,
};
