const WebSocket = require('ws');
const { OpenAI } = require('openai');
const fetch = require('node-fetch');
require('dotenv').config();

class RealTimeAIReceptionist {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    this.activeCalls = new Map();
    this.audioBuffers = new Map();
    this.conversationMemory = new Map();

    // Business data for AI responses
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

    console.log('> Real-Time AI Receptionist initialized');
  }

  startServer(port = 8080) {
    this.wss = new WebSocket.Server({
      port: 8081, // Use different port
      perMessageDeflate: false
    });

    this.wss.on('connection', (ws, req) => {
      console.log('= New WebSocket connection established');

      let callSid = null;
      let streamSid = null;
      let sessionActive = false;

      ws.on('message', async (message) => {
        try {
          const data = JSON.parse(message);

          switch (data.event) {
            case 'connected':
              console.log('=� Connected to Twilio Media Stream');
              break;

            case 'start':
              callSid = data.start.callSid;
              streamSid = data.start.streamSid;
              sessionActive = true;

              console.log(`<�  Stream started for call: ${callSid}`);

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
              console.log(`=� Stream stopped for call: ${callSid || 'unknown'}`);
              if (callSid) {
                this.cleanupCall(callSid);
              }
              sessionActive = false;
              break;
          }

        } catch (error) {
          console.error('L Error processing WebSocket message:', error);
        }
      });

      ws.on('close', () => {
        console.log('=� WebSocket connection closed');
        if (callSid) {
          this.cleanupCall(callSid);
        }
      });

      ws.on('error', (error) => {
        console.error('L WebSocket error:', error);
      });
    });

    console.log(`=� Real-Time Streaming Server running on port ${port}`);
    console.log(`=' WebSocket endpoint: ws://localhost:${port}/ws`);

    return this.wss;
  }

  async sendImmediateGreeting(ws, streamSid) {
    const greeting = "Hi there! This is Pizza Karachi's AI assistant. What can I help you with today?";
    console.log('<� Sending immediate AI greeting...');

    try {
      const audioBuffer = await this.generateElevenLabsAudio(greeting);
      if (audioBuffer) {
        this.streamAudioToTwilio(ws, streamSid, audioBuffer);
        console.log(' AI greeting sent successfully');
      }
    } catch (error) {
      console.error('L Error sending greeting:', error);
    }
  }

  async processMediaFrame(callSid, media) {
    const callSession = this.activeCalls.get(callSid);
    if (!callSession || callSession.isProcessing) return;

    // Decode �-law audio from Twilio
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

        console.log(`<� Processing ${buffer.length} audio chunks`);

        // Convert to WAV and transcribe
        const transcript = await this.transcribeWithWhisper(audioData);

        if (transcript && transcript.trim().length > 0) {
          console.log(`=� Transcribed: "${transcript}"`);

          // Get AI response
          const response = await this.generateAIResponse(callSid, transcript);

          if (response) {
            console.log(`> AI Response: "${response.substring(0, 100)}..."`);

            // Generate and stream audio
            const audioBuffer = await this.generateElevenLabsAudio(response);
            if (audioBuffer) {
              this.streamAudioToTwilio(callSession.ws, callSession.streamSid, audioBuffer);
            }
          }
        }

      } catch (error) {
        console.error('L Error processing audio:', error);
      } finally {
        callSession.isProcessing = false;
      }
    }
  }

  async transcribeWithWhisper(audioBuffer) {
    try {
      // Convert �-law to WAV format for Whisper
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
      console.error('L Whisper transcription error:', error);
      return '';
    }
  }

  convertMulawToWav(mulawBuffer) {
    // �-law to linear PCM conversion
    const pcmBuffer = Buffer.alloc(mulawBuffer.length * 2);

    for (let i = 0; i < mulawBuffer.length; i++) {
      const mulaw = mulawBuffer[i];
      // �-law decompression algorithm
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
      console.error('L AI response generation error:', error);
      return "I'm sorry, I'm having trouble processing your request. Could you please repeat that?";
    }
  }

  async generateElevenLabsAudio(text) {
    try {
      if (!process.env.ELEVENLABS_API_KEY) {
        console.log('�  ElevenLabs API key not found, using OpenAI TTS');
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
        console.log('<� ElevenLabs audio generated successfully');
        return audioBuffer;
      } else {
        console.error('L ElevenLabs API error:', response.status, response.statusText);
        return await this.generateOpenAIAudio(text);
      }

    } catch (error) {
      console.error('L ElevenLabs error:', error);
      return await this.generateOpenAIAudio(text);
    }
  }

  async generateOpenAIAudio(text) {
    try {
      const mp3Response = await this.openai.audio.speech.create({
        model: 'tts-1-hd',
        voice: 'nova',
        input: text,
        response_format: 'mp3'
      });

      const audioBuffer = Buffer.from(await mp3Response.arrayBuffer());
      console.log('<� OpenAI TTS audio generated');
      return audioBuffer;

    } catch (error) {
      console.error('L OpenAI TTS error:', error);
      return null;
    }
  }

  streamAudioToTwilio(ws, streamSid, audioBuffer) {
    try {
      // Stream audio in small chunks for real-time feel
      const chunkSize = 4096;
      let offset = 0;

      const sendChunk = () => {
        if (offset < audioBuffer.length) {
          const chunk = audioBuffer.slice(offset, offset + chunkSize);
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

          // Send next chunk with minimal delay
          setTimeout(sendChunk, 8); // 8ms for real-time streaming
        }
      };

      sendChunk();
      console.log('=� Audio streaming to Twilio initiated');

    } catch (error) {
      console.error('L Error streaming audio to Twilio:', error);
    }
  }

  cleanupCall(callSid) {
    this.activeCalls.delete(callSid);
    this.audioBuffers.delete(callSid);

    // Keep conversation memory for a few minutes
    setTimeout(() => {
      this.conversationMemory.delete(callSid);
    }, 300000); // 5 minutes

    console.log(`>� Cleaned up call session: ${callSid}`);
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
const receptionist = new RealTimeAIReceptionist();
receptionist.startServer(8080);

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('=� Shutting down Real-Time AI Receptionist...');
  process.exit(0);
});

module.exports = RealTimeAIReceptionist;