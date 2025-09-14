const express = require('express');
const router = express.Router();
const VoiceResponse = require('twilio').twiml.VoiceResponse;

/**
 * Enhanced Twilio voice endpoint that uses streaming for real-time conversation
 */
router.post('/', async (req, res) => {
  const twiml = new VoiceResponse();

  try {
    const from = req.body.From;
    const to = req.body.To;
    const callSid = req.body.CallSid;

    console.log(`[STREAM-VOICE] Incoming streaming call from ${from} to ${to}, CallSid: ${callSid}`);

    // Start streaming conversation
    const stream = twiml.start();

    // Connect to our WebSocket server for real-time audio processing
    const protocol = req.secure ? 'wss' : 'ws';
    const host = req.get('host') || `localhost:${process.env.PORT || 3001}`;

    // If using ngrok (host contains ngrok-free.app), use the same host
    // Otherwise, use localhost with port 8080
    let streamUrl;
    if (host.includes('ngrok-free.app')) {
      // Use the same ngrok tunnel but direct to WebSocket endpoint
      streamUrl = `wss://${host.replace('https://', '')}`;
    } else {
      streamUrl = `${protocol}://${host.replace(':3001', ':8080')}`;
    }

    stream.stream({
      url: streamUrl,
      name: 'AI-Receptionist-Stream'
    });

    // Add some fallback instructions
    twiml.say({
      voice: 'alice'
    }, 'Connecting you to our AI receptionist. Please wait a moment.');

    console.log(`[STREAM-VOICE] Streaming TwiML generated, connecting to: ${streamUrl}`);

  } catch (error) {
    console.error('[STREAM-VOICE] Error processing streaming call:', error);

    twiml.say({
      voice: 'alice'
    }, 'I\'m sorry, our streaming service is currently unavailable. Please try again later.');

    twiml.hangup();
  }

  res.type('text/xml').send(twiml.toString());
});

/**
 * WebSocket stream status endpoint
 */
router.get('/status', (req, res) => {
  try {
    // Provide basic stats without creating a service instance
    res.json({
      service: 'Twilio Streaming Voice',
      status: 'OK',
      timestamp: new Date().toISOString(),
      stats: {
        activeCalls: 0,
        conversationsInMemory: 0,
        uptime: process.uptime()
      },
      endpoints: [
        'POST /stream - Twilio streaming voice webhook',
        'GET /stream/status - Stream service status',
        'WebSocket ws://localhost:8080 - Real-time audio stream'
      ]
    });
  } catch (error) {
    res.status(500).json({
      service: 'Twilio Streaming Voice',
      status: 'ERROR',
      error: error.message
    });
  }
});

/**
 * Test endpoint to verify streaming configuration
 */
router.post('/test', async (req, res) => {
  const twiml = new VoiceResponse();

  // Simple test that creates a stream
  twiml.say('This is a test of the streaming voice system.');

  const stream = twiml.start();
  stream.stream({
    url: `ws://localhost:8080/test`,
    name: 'Test-Stream'
  });

  twiml.say('Stream test initiated.');

  res.type('text/xml').send(twiml.toString());
});

module.exports = router;