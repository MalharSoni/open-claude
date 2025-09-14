const express = require('express');
const WebSocket = require('ws');
const { OpenAI } = require('openai');
const fetch = require('node-fetch');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

class UnifiedAIReceptionist {
  constructor() {
    this.app = express();
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    this.activeCalls = new Map();
    this.audioBuffers = new Map();
    this.conversationMemory = new Map();

    // Business data
    this.businessData = {
      name: 'Pizza Karachi',
      hours: 'Monday-Sunday 11AM-11PM',
      phone: '(672) 207-2526',
      specialties: ['Authentic Pakistani pizza', 'Karachi-style toppings', 'Spicy chicken tikka pizza'],
      menu: {
        pizza: ['Chicken Tikka', 'Beef Seekh Kebab', 'Vegetable Supreme'],
        sides: ['Garlic naan', 'Samosas', 'Biryani rice']
      },
      delivery: 'Free delivery over $25, 30-45 minute delivery time',
      location: 'Downtown location with dine-in available'
    };

    this.setupExpress();
    console.log('🤖 Unified AI Receptionist initialized');
  }

  setupExpress() {
    this.app.use(helmet());
    this.app.use(cors());
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(express.json());

    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'OK',
        service: 'Unified AI Receptionist',
        stats: this.getStats()
      });
    });

    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({
        message: 'AI Receptionist Ready',
        endpoints: {
          stream: '/stream',
          health: '/health',
          websocket: '/media-stream'
        }
      });
    });

    // Twilio webhook endpoint
    this.app.post('/stream', (req, res) => {
      const { From, To, CallSid } = req.body;
      console.log(`📞 Incoming call from ${From} to ${To}, CallSid: ${CallSid}`);

      // Get the base URL (works for both local and production)
      const protocol = req.get('x-forwarded-proto') || (req.secure ? 'https' : 'http');
      const host = req.get('host');
      const streamUrl = `${protocol === 'https' ? 'wss' : 'ws'}://${host}/media-stream`;

      // TwiML response - NO robotic greeting, immediate stream
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Start>
    <Stream url="${streamUrl}" />
  </Start>
  <Pause length="60" />
</Response>`;

      console.log(`🎙️ Streaming to: ${streamUrl}`);
      res.set('Content-Type', 'text/xml');
      res.send(twiml);
    });
  }

  startServer(port = process.env.PORT || 3000) {
    // Create HTTP server
    const server = require('http').createServer(this.app);

    // Create WebSocket server for media streams
    const wss = new WebSocket.Server({
      server,
      path: '/media-stream'
    });

    wss.on('connection', (ws, req) => {
      console.log('🔗 New Media Stream WebSocket connection');

      let callSid = null;
      let streamSid = null;
      let sessionActive = false;

      ws.on('message', async (message) => {
        try {
          const data = JSON.parse(message);

          switch (data.event) {
            case 'connected':
              console.log('✅ Connected to Twilio Media Stream');
              break;

            case 'start':
              callSid = data.start.callSid;
              streamSid = data.start.streamSid;
              sessionActive = true;

              console.log(`🎧 Stream started for call: ${callSid}`);

              // Initialize call session
              this.activeCalls.set(callSid, {
                ws,
                streamSid,
                startTime: Date.now(),
                lastActivity: Date.now(),
                isProcessing: false
              });

              this.audioBuffers.set(callSid, []);
              this.conversationMemory.set(callSid, { messages: [] });

              // Send immediate AI greeting
              await this.sendImmediateGreeting(ws, streamSid);
              break;

            case 'media':
              if (sessionActive && callSid) {
                await this.processMediaFrame(callSid, data.media);
              }
              break;

            case 'stop':
              console.log(`⏹️ Stream stopped for call: ${callSid || 'unknown'}`);
              if (callSid) {
                this.cleanupCall(callSid);
              }
              sessionActive = false;
              break;
          }

        } catch (error) {
          console.error('❌ Error processing message:', error);
        }
      });

      ws.on('close', () => {
        console.log('🔌 WebSocket connection closed');
        if (callSid) {
          this.cleanupCall(callSid);
        }
      });

      ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error);
      });
    });

    // Start the server
    server.listen(port, '0.0.0.0', () => {
      console.log(`🚀 Unified AI Receptionist running on port ${port}`);
      console.log(`📞 Webhook URL: http://localhost:${port}/webhook`);
      console.log(`🔌 WebSocket endpoint: ws://localhost:${port}/media-stream`);
      console.log(`💚 Health check: http://localhost:${port}/health`);
    });

    return server;
  }

  async sendImmediateGreeting(ws, streamSid) {
    const greeting = "Hi there! This is Pizza Karachi's AI assistant. What can I help you with today?";
    console.log('🎙️ Sending immediate AI greeting...');

    try {
      const audioBuffer = await this.generateElevenLabsAudio(greeting);
      if (audioBuffer) {
        this.streamAudioToTwilio(ws, streamSid, audioBuffer);
        console.log('✅ AI greeting sent successfully');
      }
    } catch (error) {
      console.error('❌ Error sending greeting:', error);
    }
  }

  async processMediaFrame(callSid, media) {
    const callSession = this.activeCalls.get(callSid);
    if (!callSession || callSession.isProcessing) return;

    // Decode μ-law audio from Twilio
    const audioChunk = Buffer.from(media.payload, 'base64');

    // Add to buffer
    const buffer = this.audioBuffers.get(callSid);
    buffer.push(audioChunk);
    callSession.lastActivity = Date.now();

    // Process when we have enough audio (0.8 seconds = ~40 chunks)
    if (buffer.length >= 40) {
      callSession.isProcessing = true;

      try {
        const audioData = Buffer.concat(buffer);
        this.audioBuffers.set(callSid, []); // Clear buffer

        console.log(`🎧 Processing ${buffer.length} audio chunks`);

        // Convert to WAV and transcribe
        const transcript = await this.transcribeWithWhisper(audioData);

        if (transcript && transcript.trim().length > 0) {
          console.log(`📝 Transcribed: "${transcript}"`);

          // Get AI response
          const response = await this.generateAIResponse(callSid, transcript);

          if (response) {
            console.log(`🤖 AI Response: "${response.substring(0, 100)}..."`);

            // Generate and stream audio
            const audioBuffer = await this.generateElevenLabsAudio(response);
            if (audioBuffer) {
              this.streamAudioToTwilio(callSession.ws, callSession.streamSid, audioBuffer);
            }
          }
        }

      } catch (error) {
        console.error('❌ Error processing audio:', error);
      } finally {
        callSession.isProcessing = false;
      }
    }
  }

  async transcribeWithWhisper(audioBuffer) {
    try {
      // Convert μ-law to WAV format for Whisper
      const wavBuffer = this.convertMulawToWav(audioBuffer);

      // Create file blob for Whisper API
      const audioFile = new File([wavBuffer], 'audio.wav', { type: 'audio/wav' });

      const transcription = await this.openai.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1',
        language: 'en',
        response_format: 'text'
      });

      return transcription?.trim() || '';

    } catch (error) {
      console.error('❌ Whisper transcription error:', error);
      return '';
    }
  }

  convertMulawToWav(mulawBuffer) {
    // μ-law to linear PCM conversion
    const pcmBuffer = Buffer.alloc(mulawBuffer.length * 2);

    for (let i = 0; i < mulawBuffer.length; i++) {
      const mulaw = mulawBuffer[i];
      // μ-law decompression algorithm
      let sign = (mulaw & 0x80) ? -1 : 1;
      let exponent = (mulaw & 0x70) >> 4;
      let mantissa = mulaw & 0x0F;

      let sample = mantissa | 0x10;
      sample = sample << (exponent + 3);
      sample = sample * sign;

      // Clamp to 16-bit range
      sample = Math.max(-32768, Math.min(32767, sample));

      pcmBuffer.writeInt16LE(sample, i * 2);
    }

    // Create WAV header
    const wavHeader = Buffer.alloc(44);
    const dataSize = pcmBuffer.length;

    wavHeader.write('RIFF', 0);
    wavHeader.writeUInt32LE(36 + dataSize, 4);
    wavHeader.write('WAVE', 8);
    wavHeader.write('fmt ', 12);
    wavHeader.writeUInt32LE(16, 16);
    wavHeader.writeUInt16LE(1, 20);
    wavHeader.writeUInt16LE(1, 22);
    wavHeader.writeUInt32LE(8000, 24);
    wavHeader.writeUInt32LE(16000, 28);
    wavHeader.writeUInt16LE(2, 32);
    wavHeader.writeUInt16LE(16, 34);
    wavHeader.write('data', 36);
    wavHeader.writeUInt32LE(dataSize, 40);

    return Buffer.concat([wavHeader, pcmBuffer]);
  }

  async generateAIResponse(callSid, userInput) {
    try {
      const memory = this.conversationMemory.get(callSid);

      // Add user message to memory
      memory.messages.push({
        role: 'user',
        content: userInput
      });

      // System prompt with business data
      const systemPrompt = `You are an AI receptionist for ${this.businessData.name}.

Business Info:
- Hours: ${this.businessData.hours}
- Phone: ${this.businessData.phone}
- Specialties: ${this.businessData.specialties.join(', ')}
- Delivery: ${this.businessData.delivery}
- Location: ${this.businessData.location}

Menu:
Pizza: ${this.businessData.menu.pizza.join(', ')}
Sides: ${this.businessData.menu.sides.join(', ')}

Respond naturally and helpfully. Keep responses conversational and under 50 words. If they want to place an order, get their details and confirm.`;

      const messages = [
        { role: 'system', content: systemPrompt },
        ...memory.messages.slice(-10) // Keep last 10 messages for context
      ];

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: messages,
        max_tokens: 150,
        temperature: 0.7
      });

      const response = completion.choices[0].message.content;

      // Add AI response to memory
      memory.messages.push({
        role: 'assistant',
        content: response
      });

      return response;

    } catch (error) {
      console.error('❌ AI response generation error:', error);
      return "I'm sorry, I'm having trouble processing your request. Could you please repeat that?";
    }
  }

  async generateElevenLabsAudio(text) {
    try {
      if (!process.env.ELEVENLABS_API_KEY) {
        console.log('⚠️ ElevenLabs API key not found, using OpenAI TTS');
        return await this.generateOpenAIAudio(text);
      }

      const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM', {
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
            stability: 0.6,
            similarity_boost: 0.8,
            style: 0.2,
            use_speaker_boost: true
          }
        })
      });

      if (response.ok) {
        const audioBuffer = Buffer.from(await response.arrayBuffer());
        console.log('🎵 ElevenLabs audio generated successfully');
        return audioBuffer;
      } else {
        console.error('❌ ElevenLabs API error:', response.status, response.statusText);
        return await this.generateOpenAIAudio(text);
      }

    } catch (error) {
      console.error('❌ ElevenLabs error:', error);
      return await this.generateOpenAIAudio(text);
    }
  }

  async generateOpenAIAudio(text) {
    try {
      const wavResponse = await this.openai.audio.speech.create({
        model: 'tts-1-hd',
        voice: 'nova',
        input: text,
        response_format: 'wav'
      });

      const audioBuffer = Buffer.from(await wavResponse.arrayBuffer());
      console.log('🎵 OpenAI TTS audio generated (WAV)');
      return audioBuffer;

    } catch (error) {
      console.error('❌ OpenAI TTS error:', error);
      return null;
    }
  }

  streamAudioToTwilio(ws, streamSid, audioBuffer) {
    try {
      console.log(`🎵 Processing ${audioBuffer.length} bytes of audio for Twilio`);

      // Extract PCM data from WAV file
      let pcmData;
      if (audioBuffer.length > 44 && audioBuffer.toString('ascii', 0, 4) === 'RIFF') {
        // WAV file - extract PCM data (skip 44-byte header)
        pcmData = audioBuffer.slice(44);
        console.log(`📊 Extracted ${pcmData.length} bytes of PCM data from WAV`);
      } else {
        console.log('⚠️ Audio not in WAV format, using as-is');
        pcmData = audioBuffer;
      }

      // Convert PCM to μ-law
      const mulawBuffer = this.pcmToMulaw(pcmData);
      console.log(`🔄 Converted to ${mulawBuffer.length} bytes of μ-law`);

      // Stream in small chunks (160 bytes = 20ms of audio at 8kHz μ-law)
      const chunkSize = 160;
      let offset = 0;

      const sendChunk = () => {
        if (offset < mulawBuffer.length && ws.readyState === WebSocket.OPEN) {
          const chunk = mulawBuffer.slice(offset, Math.min(offset + chunkSize, mulawBuffer.length));
          const base64Audio = chunk.toString('base64');

          const mediaMessage = {
            event: 'media',
            streamSid: streamSid,
            media: {
              payload: base64Audio
            }
          };

          ws.send(JSON.stringify(mediaMessage));
          offset += chunkSize;

          // Send next chunk after 20ms
          setTimeout(sendChunk, 20);
        } else if (offset >= mulawBuffer.length) {
          console.log('✅ Audio streaming completed');
        }
      };

      sendChunk();

    } catch (error) {
      console.error('❌ Error streaming audio to Twilio:', error);
    }
  }

  convertToMulaw(audioBuffer) {
    // Convert MP3 to PCM first, then to μ-law
    // For now, we'll use a simplified approach - send as base64 PCM
    // Twilio expects μ-law but can handle some PCM formats
    try {
      // If it's MP3, we need to decode it first
      // For production, you'd use ffmpeg or a proper audio library
      // For now, let's try a simpler approach - convert to 8kHz mono PCM

      // Simplified: assume it's already in a usable format or convert basic headers
      if (audioBuffer.length > 44 && audioBuffer.toString('ascii', 0, 4) === 'RIFF') {
        // It's a WAV file, extract PCM data (skip 44-byte header)
        const pcmData = audioBuffer.slice(44);
        return this.pcmToMulaw(pcmData);
      }

      // For MP3 or other formats, we need a more complex conversion
      // As a fallback, return a silence buffer in μ-law format
      console.log('⚠️ Audio format conversion needed - using fallback');
      const silenceBuffer = Buffer.alloc(1024);
      silenceBuffer.fill(0xFF); // μ-law silence
      return silenceBuffer;

    } catch (error) {
      console.error('❌ Audio conversion error:', error);
      // Return μ-law silence as fallback
      const silenceBuffer = Buffer.alloc(1024);
      silenceBuffer.fill(0xFF);
      return silenceBuffer;
    }
  }

  pcmToMulaw(pcmBuffer) {
    // Convert 16-bit PCM to μ-law
    const mulawBuffer = Buffer.alloc(pcmBuffer.length / 2);

    for (let i = 0; i < pcmBuffer.length; i += 2) {
      const sample = pcmBuffer.readInt16LE(i);
      mulawBuffer[i / 2] = this.linearToMulaw(sample);
    }

    return mulawBuffer;
  }

  linearToMulaw(sample) {
    // Linear PCM to μ-law conversion
    const MULAW_BIAS = 0x84;
    const MULAW_MAX = 0x1FFF;

    if (sample < 0) {
      sample = -sample;
      var sign = 0x80;
    } else {
      var sign = 0x00;
    }

    if (sample > MULAW_MAX) sample = MULAW_MAX;
    sample += MULAW_BIAS;

    let exponent = 7;
    for (let exp_lut = [256, 512, 1024, 2048, 4096, 8192, 16384, 32768];
         exponent > 0 && sample < exp_lut[exponent - 1];
         exponent--) {}

    const mantissa = (sample >> (exponent + 3)) & 0x0F;
    return ~(sign | (exponent << 4) | mantissa);
  }

  cleanupCall(callSid) {
    this.activeCalls.delete(callSid);
    this.audioBuffers.delete(callSid);

    // Keep conversation memory for a few minutes
    setTimeout(() => {
      this.conversationMemory.delete(callSid);
    }, 300000); // 5 minutes

    console.log(`🧹 Cleaned up call session: ${callSid}`);
  }

  getStats() {
    return {
      activeCalls: this.activeCalls.size,
      conversationsInMemory: this.conversationMemory.size,
      uptime: process.uptime()
    };
  }
}

// Start the server
const receptionist = new UnifiedAIReceptionist();
const PORT = process.env.PORT || 3000;
receptionist.startServer(PORT);

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('⏹️ Shutting down AI Receptionist...');
  process.exit(0);
});

module.exports = UnifiedAIReceptionist;