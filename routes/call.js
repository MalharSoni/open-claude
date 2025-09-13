const express = require('express');
const Joi = require('joi');
const fetch = require('node-fetch');
const businessKnowledge = require('../data/business_knowledge.json');
const bookingService = require('../services/mockBookingService');

const router = express.Router();

const callSchema = Joi.object({
  customerPhone: Joi.string().pattern(/^[\+]?[1-9][\d]{0,15}$/).optional(),
  customerName: Joi.string().min(2).max(100).optional(),
  intent: Joi.string().valid('booking', 'inquiry', 'support', 'general').default('general'),
  message: Joi.string().max(1000).optional()
});

const ttsSchema = Joi.object({
  text: Joi.string().required(),
  voice: Joi.string().default('alloy'),
  model: Joi.string().default('tts-1')
});

class VoiceCallService {
  constructor() {
    this.conversations = new Map();
  }

  async generateResponse(intent, message, customerName = 'Customer') {
    const context = this.buildContext(intent, message);

    switch (intent) {
      case 'booking':
        return await this.handleBookingIntent(message, customerName);
      case 'inquiry':
        return this.handleInquiryIntent(message, customerName);
      case 'support':
        return this.handleSupportIntent(message, customerName);
      default:
        return this.handleGeneralIntent(message, customerName);
    }
  }

  buildContext(intent, message) {
    return {
      businessInfo: businessKnowledge.businessInfo,
      hours: businessKnowledge.hours,
      services: businessKnowledge.services,
      policies: businessKnowledge.policies,
      commonQuestions: businessKnowledge.commonQuestions
    };
  }

  async handleBookingIntent(message, customerName) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const availableSlots = await bookingService.getAvailableSlots(today);

      const response = `Hi ${customerName}! I'd be happy to help you schedule an appointment.

We offer several services:
${businessKnowledge.services.map(s => `• ${s.name} (${s.duration} minutes - $${s.price})`).join('\n')}

For today, I have ${availableSlots.length} available time slots. Would you like me to check availability for a specific service and time? Please let me know:
1. Which service you're interested in
2. Your preferred date and time
3. Your contact information

I can book your appointment right away once I have these details.`;

      return {
        text: response,
        suggestedActions: [
          'Check availability for today',
          'Book a consultation',
          'See all services',
          'Speak with someone'
        ]
      };
    } catch (error) {
      return {
        text: `Hi ${customerName}! I'd be happy to help you schedule an appointment. Let me get some basic information from you first. What type of service are you looking for, and when would you prefer to meet?`,
        suggestedActions: ['See services', 'Check availability', 'Speak with someone']
      };
    }
  }

  handleInquiryIntent(message, customerName) {
    const response = `Hi ${customerName}! I'm here to answer any questions about our services.

${businessKnowledge.businessInfo.name} offers:
${businessKnowledge.services.map(s => `• ${s.name}: ${s.description}`).join('\n')}

We're open:
• Monday-Friday: 9 AM - 5 PM
• Saturday: 10 AM - 2 PM
• Sunday: Closed

What specific information can I provide for you?`;

    return {
      text: response,
      suggestedActions: [
        'Learn about services',
        'Check business hours',
        'Ask about pricing',
        'Schedule appointment'
      ]
    };
  }

  handleSupportIntent(message, customerName) {
    const response = `Hi ${customerName}! I'm here to help with any support questions you might have.

For technical support, we offer:
• Troubleshooting assistance
• System guidance
• Account help
• General technical questions

If you need immediate assistance, I can:
1. Schedule a support appointment
2. Connect you with our technical team
3. Provide basic troubleshooting steps

What kind of support do you need today?`;

    return {
      text: response,
      suggestedActions: [
        'Schedule support appointment',
        'Speak with technical team',
        'Basic troubleshooting',
        'Account assistance'
      ]
    };
  }

  handleGeneralIntent(message, customerName) {
    const greeting = this.getTimeBasedGreeting();

    const response = `${greeting} ${customerName}! Welcome to ${businessKnowledge.businessInfo.name}.

I'm your AI assistant and I can help you with:
• Scheduling appointments
• Answering questions about our services
• Providing business information
• Technical support

How can I assist you today?`;

    return {
      text: response,
      suggestedActions: [
        'Schedule appointment',
        'Learn about services',
        'Ask a question',
        'Get support'
      ]
    };
  }

  getTimeBasedGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }

  async synthesizeSpeech(text) {
    try {
      if (!process.env.ELEVENLABS_API_KEY && !process.env.OPENAI_API_KEY) {
        return { error: 'No TTS service configured' };
      }

      if (process.env.ELEVENLABS_API_KEY) {
        return await this.elevenLabsTTS(text);
      } else if (process.env.OPENAI_API_KEY) {
        return await this.openAITTS(text);
      }
    } catch (error) {
      console.error('TTS Error:', error);
      return { error: 'Speech synthesis failed' };
    }
  }

  async elevenLabsTTS(text) {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${process.env.ELEVENLABS_VOICE_ID || 'pNInz6obpgDQGcFmaJgB'}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': process.env.ELEVENLABS_API_KEY
      },
      body: JSON.stringify({
        text: text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5
        }
      })
    });

    if (!response.ok) {
      throw new Error('ElevenLabs TTS request failed');
    }

    const audioBuffer = await response.buffer();
    return {
      audio: audioBuffer.toString('base64'),
      contentType: 'audio/mpeg'
    };
  }

  async openAITTS(text) {
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: text,
        voice: 'alloy'
      })
    });

    if (!response.ok) {
      throw new Error('OpenAI TTS request failed');
    }

    const audioBuffer = await response.buffer();
    return {
      audio: audioBuffer.toString('base64'),
      contentType: 'audio/mpeg'
    };
  }
}

const voiceService = new VoiceCallService();

router.post('/', async (req, res) => {
  try {
    const { error, value } = callSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Invalid call data',
        details: error.details[0].message
      });
    }

    const { customerPhone, customerName, intent, message } = value;
    const conversationId = `${customerPhone || 'anonymous'}_${Date.now()}`;

    const response = await voiceService.generateResponse(intent, message, customerName);

    voiceService.conversations.set(conversationId, {
      customerPhone,
      customerName,
      startTime: new Date().toISOString(),
      messages: [
        { role: 'user', content: message || 'Started conversation', timestamp: new Date().toISOString() },
        { role: 'assistant', content: response.text, timestamp: new Date().toISOString() }
      ]
    });

    res.json({
      conversationId,
      response: response.text,
      suggestedActions: response.suggestedActions || [],
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error handling call:', error);
    res.status(500).json({
      error: 'Failed to process call',
      message: error.message
    });
  }
});

router.post('/tts', async (req, res) => {
  try {
    const { error, value } = ttsSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Invalid TTS request',
        details: error.details[0].message
      });
    }

    const { text } = value;
    const result = await voiceService.synthesizeSpeech(text);

    if (result.error) {
      return res.status(500).json({ error: result.error });
    }

    res.json({
      audio: result.audio,
      contentType: result.contentType,
      text: text
    });
  } catch (error) {
    console.error('Error generating speech:', error);
    res.status(500).json({
      error: 'Failed to generate speech',
      message: error.message
    });
  }
});

router.get('/conversation/:conversationId', (req, res) => {
  const { conversationId } = req.params;
  const conversation = voiceService.conversations.get(conversationId);

  if (!conversation) {
    return res.status(404).json({ error: 'Conversation not found' });
  }

  res.json(conversation);
});

router.get('/health', (req, res) => {
  res.json({
    service: 'Voice Call Service',
    status: 'OK',
    endpoints: [
      'POST /call',
      'POST /call/tts',
      'GET /call/conversation/:conversationId'
    ],
    activeConversations: voiceService.conversations.size
  });
});

module.exports = router;