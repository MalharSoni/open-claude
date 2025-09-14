const express = require('express');
const router = express.Router();
const VoiceResponse = require('twilio').twiml.VoiceResponse;
const { handleCallLogic } = require('../services/callLogic');

/**
 * Twilio Voice webhook endpoint
 * Handles incoming phone calls and converts them to our AI receptionist
 */
router.post('/', async (req, res) => {
  const twiml = new VoiceResponse();

  try {
    // Get the spoken input from Twilio
    const userSpeech = req.body.SpeechResult || req.body.TranscriptionText;
    const from = req.body.From;
    const to = req.body.To;

    console.log(`[VOICE] Incoming call from ${from} to ${to}`);

    if (!userSpeech) {
      // First call or no speech detected
      const gather = twiml.gather({
        input: 'speech',
        action: '/voice',
        method: 'POST',
        speechTimeout: 'auto',
        speechModel: 'experimental_conversations'
      });

      gather.say({
        voice: 'alice'
      }, 'Hello! Welcome to Pizza Karachi. How can I help you today?');

      // Fallback if no input
      twiml.say('Sorry, I didn\'t hear anything. Please call back when you\'re ready to speak.');

      res.type('text/xml').send(twiml.toString());
      return;
    }

    console.log(`[VOICE] Speech detected: "${userSpeech}"`);

    // Use our centralized call logic with default business
    // TODO: In production, you might detect business_id from the phone number called
    const businessId = 'pizzakarachi'; // Default for now

    const result = await handleCallLogic(userSpeech, businessId);

    console.log(`[VOICE] Generated response for intent: ${result.intent}`);

    // Play the generated audio if available
    if (result.audio_available && result.audio_url_relative) {
      // Convert relative URL to absolute for Twilio
      const protocol = req.secure ? 'https' : 'http';
      const host = req.get('host') || `localhost:${process.env.PORT || 3000}`;
      const audioUrl = `${protocol}://${host}${result.audio_url_relative}`;

      console.log(`[VOICE] Playing audio: ${audioUrl}`);
      twiml.play(audioUrl);
    } else {
      // Fallback to Twilio's TTS
      console.log(`[VOICE] Using Twilio TTS fallback`);
      twiml.say({
        voice: 'alice'
      }, result.text_response);
    }

    // Continue the conversation
    const gather = twiml.gather({
      input: 'speech',
      action: '/voice',
      method: 'POST',
      speechTimeout: 'auto',
      speechModel: 'experimental_conversations'
    });

    gather.say({
      voice: 'alice'
    }, 'Is there anything else I can help you with?');

    // End call if no response
    twiml.say('Thank you for calling Pizza Karachi. Have a great day!');
    twiml.hangup();

  } catch (error) {
    console.error('[VOICE] Error processing call:', error);

    twiml.say({
      voice: 'alice'
    }, 'I\'m sorry, I\'m having technical difficulties. Please try calling back later.');

    twiml.hangup();
  }

  res.type('text/xml').send(twiml.toString());
});

/**
 * Health check for Twilio webhooks
 */
router.get('/health', (req, res) => {
  res.json({
    service: 'Twilio Voice Webhook',
    status: 'OK',
    timestamp: new Date().toISOString(),
    endpoints: [
      'POST /voice - Main voice webhook'
    ]
  });
});

module.exports = router;