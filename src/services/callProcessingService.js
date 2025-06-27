const { transcribeAudio } = require('./whisperService');
const { analyzeCall } = require('./gptService');
const Call = require('../../models/call');

/**
 * Complete call processing service - handles transcription and analysis
 * This runs in the background after file upload
 */
class CallProcessingService {
  
  /**
   * Process a call completely - transcribe and analyze
   * @param {string} callId - MongoDB call document ID
   * @returns {Promise<Object>} - Processing results
   */
  static async processCallComplete(callId) {
    if (!callId) {
      throw new Error('Call ID is required');
    }

    let call;
    try {
      // Get the call from database
      call = await Call.findById(callId);
      if (!call) {
        throw new Error(`Call not found with ID: ${callId}`);
      }

      if (!call.audioUrl) {
        throw new Error('No audio URL found for this call');
      }

      console.log(`🎯 Starting background processing for call ${callId}`);
      console.log(`📁 Audio URL: ${call.audioUrl}`);

      // Update status to processing
      await Call.findByIdAndUpdate(callId, { status: 'processing' });

      const startTime = Date.now();

      // Step 1: Transcribe the audio
      console.log('🎙️ Step 1: Transcribing audio...');
      const transcriptionStart = Date.now();
      const transcript = await transcribeAudio(call.audioUrl, true);
      const transcriptionTime = Date.now() - transcriptionStart;

      if (!transcript || transcript.trim() === '') {
        await Call.findByIdAndUpdate(callId, { status: 'failed' });
        throw new Error('Transcription failed - empty result');
      }

      console.log(`✅ Transcription completed in ${transcriptionTime}ms`);

      // Step 2: Analyze the transcript
      console.log('🧠 Step 2: Analyzing transcript...');
      const analysisStart = Date.now();
      const analysis = await analyzeCall(transcript);
      const analysisTime = Date.now() - analysisStart;

      console.log(`✅ Analysis completed in ${analysisTime}ms`);

      const totalTime = Date.now() - startTime;

      // Step 3: Save everything to database
      const updatedCall = await Call.findByIdAndUpdate(
        callId,
        {
          transcript,
          sentiment: analysis.sentiment,
          score: analysis.score,
          feedback: analysis.feedback,
          summary: analysis.summary,
          status: 'analyzed'
        },
        { new: true }
      );

      const result = {
        callId,
        success: true,
        transcript,
        analysis: {
          sentiment: analysis.sentiment,
          score: analysis.score,
          feedback: analysis.feedback,
          summary: analysis.summary
        },
        performance: {
          transcriptionTimeMs: transcriptionTime,
          analysisTimeMs: analysisTime,
          totalTimeMs: totalTime,
          transcriptLength: transcript.length,
          wordCount: transcript.split(' ').length
        },
        updatedCall
      };

      console.log(`🎉 Background processing completed for call ${callId} in ${totalTime}ms`);
      console.log(`📊 Results: ${analysis.sentiment} sentiment, score: ${analysis.score}`);

      return result;

    } catch (error) {
      console.error(`❌ Background processing failed for call ${callId}:`, error.message);
      
      // Update call status to failed
      if (call) {
        await Call.findByIdAndUpdate(callId, { 
          status: 'failed',
          // Optionally store the error message
          errorMessage: error.message 
        }).catch(console.error);
      }

      // Re-throw for logging purposes, but don't crash the app
      throw error;
    }
  }

  /**
   * Process call in background (fire and forget)
   * @param {string} callId - MongoDB call document ID
   */
  static processCallInBackground(callId) {
    // Use setImmediate to run in next tick, non-blocking
    setImmediate(async () => {
      try {
        await this.processCallComplete(callId);
      } catch (error) {
        // Log error but don't crash the application
        console.error(`Background processing error for call ${callId}:`, error);
        
        // Could add additional error handling here:
        // - Send notification to admin
        // - Add to retry queue
        // - Log to external service
      }
    });
  }

  /**
   * Get processing status for a call
   * @param {string} callId - MongoDB call document ID
   * @returns {Promise<Object>} - Call status and results if available
   */
  static async getCallStatus(callId) {
    const call = await Call.findById(callId).select('status transcript sentiment score feedback summary createdAt updatedAt');
    
    if (!call) {
      throw new Error('Call not found');
    }

    return {
      callId,
      status: call.status,
      hasTranscript: !!call.transcript,
      hasAnalysis: !!(call.sentiment && call.score),
      results: call.status === 'analyzed' ? {
        transcript: call.transcript,
        sentiment: call.sentiment,
        score: call.score,
        feedback: call.feedback,
        summary: call.summary
      } : null,
      timestamps: {
        created: call.createdAt,
        lastUpdated: call.updatedAt
      }
    };
  }
}

module.exports = CallProcessingService;
