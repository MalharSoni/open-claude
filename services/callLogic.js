const fs = require('fs');
const path = require('path');
const intentDetector = require('./intent');
const ttsService = require('./tts');

/**
 * Core call handling logic that can be reused across different routes
 * @param {string} user_input - The user's spoken or typed input
 * @param {string} business_id - The business ID to load data for
 * @returns {Promise<Object>} Response object with text, intent, audio info
 */
async function handleCallLogic(user_input, business_id) {
  try {
    // Load business data
    const businessDataPath = path.join(__dirname, '..', 'data', `${business_id}.json`);

    if (!fs.existsSync(businessDataPath)) {
      throw new Error(`No data found for business_id: ${business_id}`);
    }

    const businessData = JSON.parse(fs.readFileSync(businessDataPath, 'utf8'));

    // Detect intent
    const intent = intentDetector.detectIntent(user_input);

    // Generate response
    const responseText = intentDetector.generateResponse(intent, businessData);

    // Initialize response object
    const response = {
      text_response: responseText,
      response: responseText, // backwards compatibility
      intent: intent,
      business_id: business_id,
      audio_available: false,
      audio_url: null,
      audio_url_relative: null
    };

    // Try to generate audio if TTS is configured
    if (process.env.ELEVENLABS_API_KEY || process.env.OPENAI_API_KEY || process.env.TTS_PROVIDER === 'open_source') {
      try {
        const audioData = await ttsService.generateAudio(responseText, business_id);

        if (audioData && audioData.success) {
          response.audio_available = true;
          response.audio_url_relative = audioData.url;
          response.audio = audioData.audio;
          response.audio_content_type = audioData.contentType;
          response.audio_provider = audioData.provider;
        }
      } catch (ttsError) {
        console.error('[CALL_LOGIC] TTS generation failed:', ttsError);
        // Continue without audio - text response is still available
      }
    }

    return response;

  } catch (error) {
    console.error('[CALL_LOGIC] Error processing call:', error);
    throw error;
  }
}

/**
 * Enhanced version that includes absolute URL generation
 * @param {string} user_input - The user's spoken or typed input
 * @param {string} business_id - The business ID to load data for
 * @param {Object} req - Express request object (for URL generation)
 * @returns {Promise<Object>} Response object with absolute URLs
 */
async function handleCallLogicWithAbsoluteUrls(user_input, business_id, req = null) {
  const response = await handleCallLogic(user_input, business_id);

  // Make audio URL absolute if available and request context is provided
  if (response.audio_available && response.audio_url_relative && req) {
    const protocol = req.secure ? 'https' : 'http';
    const host = req.get('host') || `localhost:${process.env.PORT || 3000}`;
    response.audio_url = `${protocol}://${host}${response.audio_url_relative}`;
  } else if (response.audio_available && response.audio_url_relative) {
    // For cases where we don't have req context, use relative URL as absolute
    response.audio_url = response.audio_url_relative;
  }

  return response;
}

module.exports = {
  handleCallLogic,
  handleCallLogicWithAbsoluteUrls
};