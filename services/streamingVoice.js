const WebSocket = require('ws');
const { OpenAI } = require('openai');
const { handleCallLogic } = require('./callLogic');

class StreamingVoiceService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    // Store active call sessions
    this.activeCalls = new Map();

    // Audio buffer for each call
    this.audioBuffers = new Map();

    // Conversation memory per CallSid
    this.conversationMemory = new Map();

    console.log('[STREAMING] Voice service initialized');
  }

  /**
   * Start WebSocket server for Twilio Stream
   */
  startWebSocketServer(port = 8080) {
    this.wss = new WebSocket.Server({
      port,
      perMessageDeflate: false
    });

    this.wss.on('connection', (ws, req) => {
      console.log('[STREAM] New WebSocket connection established');

      // Initialize session data
      let callSid = null;
      let streamSid = null;
      let isCallActive = false;

      ws.on('message', async (message) => {
        try {
          const data = JSON.parse(message);
          await this.handleStreamMessage(ws, data, { callSid, streamSid, isCallActive });

          // Update session variables
          if (data.event === 'start') {
            callSid = data.start?.callSid;
            streamSid = data.start?.streamSid;
            isCallActive = true;
          }
        } catch (error) {
          console.error('[STREAM] Error processing message:', error);
        }
      });

      ws.on('close', () => {
        console.log(`[STREAM] Connection closed for call: ${callSid}`);
        if (callSid) {
          this.cleanupCall(callSid);
        }
      });

      ws.on('error', (error) => {
        console.error('[STREAM] WebSocket error:', error);
      });
    });

    console.log(`[STREAMING] WebSocket server listening on port ${port}`);
    return this.wss;
  }

  /**
   * Handle different types of stream messages from Twilio
   */
  async handleStreamMessage(ws, data, session) {
    const { event } = data;

    switch (event) {
      case 'connected':
        console.log('[STREAM] WebSocket connected to Twilio');
        break;

      case 'start':
        await this.handleStreamStart(ws, data);
        break;

      case 'media':
        await this.handleMediaFrame(ws, data, session);
        break;

      case 'stop':
        await this.handleStreamStop(data);
        break;

      default:
        console.log(`[STREAM] Unknown event: ${event}`);
    }
  }

  /**
   * Handle stream start - initialize call session
   */
  async handleStreamStart(ws, data) {
    const { callSid, streamSid } = data.start;

    console.log(`[STREAM] Starting stream for call: ${callSid}`);

    // Initialize call session
    this.activeCalls.set(callSid, {
      ws: ws,
      streamSid: streamSid,
      startTime: Date.now(),
      audioBuffer: [],
      isProcessing: false,
      lastActivity: Date.now()
    });

    // Initialize audio buffer for this call
    this.audioBuffers.set(callSid, []);

    // Initialize conversation memory
    this.conversationMemory.set(callSid, {
      messages: [],
      businessId: 'pizzakarachi', // Default, could be dynamic
      context: {}
    });

    // Send initial greeting
    await this.sendInitialGreeting(ws, streamSid);
  }

  /**
   * Send initial greeting to caller
   */
  async sendInitialGreeting(ws, streamSid) {
    try {
      const greetingText = "Hello! Welcome to Pizza Karachi. How can I help you today?";

      console.log('[STREAM] Generating initial greeting...');

      // Generate TTS for greeting
      const audioBuffer = await this.generateSpeechAudio(greetingText);

      if (audioBuffer) {
        console.log('[STREAM] Sending greeting audio to caller...');
        // Send audio to Twilio stream
        this.sendAudioToStream(ws, streamSid, audioBuffer);

        // Add delay to ensure greeting is fully played
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

      console.log('[STREAM] Initial greeting sent');
    } catch (error) {
      console.error('[STREAM] Error sending greeting:', error);
    }
  }

  /**
   * Handle incoming audio frames from caller
   */
  async handleMediaFrame(ws, data, session) {
    const { callSid } = session;
    if (!callSid) return;

    const callSession = this.activeCalls.get(callSid);
    if (!callSession) return;

    // Update last activity
    callSession.lastActivity = Date.now();

    // Decode base64 audio payload
    const audioChunk = Buffer.from(data.media.payload, 'base64');

    // Add to buffer
    let audioBuffer = this.audioBuffers.get(callSid) || [];
    audioBuffer.push(audioChunk);
    this.audioBuffers.set(callSid, audioBuffer);

    // Check if we should process the accumulated audio
    if (this.shouldProcessAudio(callSession, audioBuffer)) {
      await this.processAccumulatedAudio(ws, callSid, audioBuffer);
    }
  }

  /**
   * Determine if we should process accumulated audio
   */
  shouldProcessAudio(callSession, audioBuffer) {
    const bufferDuration = audioBuffer.length * 20; // Assuming 20ms per chunk
    const timeSinceLastProcess = Date.now() - (callSession.lastProcessTime || 0);

    // Process if:
    // 1. Buffer has 3+ seconds of audio (more buffer for better transcription), OR
    // 2. 5+ seconds since last processing (catch end of speech) AND buffer has at least 1 second
    return bufferDuration >= 3000 ||
           (timeSinceLastProcess >= 5000 && bufferDuration >= 1000 && !callSession.isProcessing);
  }

  /**
   * Process accumulated audio through STT
   */
  async processAccumulatedAudio(ws, callSid, audioBuffer) {
    const callSession = this.activeCalls.get(callSid);
    if (!callSession || callSession.isProcessing) return;

    callSession.isProcessing = true;
    callSession.lastProcessTime = Date.now();

    try {
      console.log(`[STT] Processing ${audioBuffer.length} audio chunks for call: ${callSid}`);

      // Combine audio chunks
      const combinedAudio = Buffer.concat(audioBuffer);

      // Check minimum audio length (Whisper needs at least 0.1 seconds)
      const estimatedDuration = audioBuffer.length * 20; // 20ms per chunk
      if (estimatedDuration < 100) {
        console.log(`[STT] Audio too short (${estimatedDuration}ms), skipping transcription`);
        callSession.isProcessing = false;
        return;
      }

      // Clear buffer
      this.audioBuffers.set(callSid, []);

      // Convert to text using Whisper
      const transcription = await this.transcribeAudio(combinedAudio);

      if (transcription && transcription.trim().length > 0) {
        console.log(`[STT] Transcribed: "${transcription}"`);

        // Process the transcription through our AI
        await this.processTranscription(ws, callSid, transcription);
      } else {
        console.log('[STT] No meaningful transcription detected');
      }

    } catch (error) {
      console.error('[STT] Error processing audio:', error);
    } finally {
      callSession.isProcessing = false;
    }
  }

  /**
   * Transcribe audio using OpenAI Whisper
   */
  async transcribeAudio(audioBuffer) {
    try {
      // Convert raw audio to WAV format for Whisper
      const wavBuffer = this.convertToWav(audioBuffer);

      // Create a temporary file-like object
      const audioFile = new File([wavBuffer], 'audio.wav', { type: 'audio/wav' });

      const transcription = await this.openai.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1',
        language: 'en',
        response_format: 'text'
      });

      return transcription.trim();
    } catch (error) {
      console.error('[STT] Whisper transcription error:', error);
      return null;
    }
  }

  /**
   * Convert raw audio buffer to WAV format
   */
  convertToWav(audioBuffer) {
    // Simple WAV header creation for 8kHz, 16-bit, mono
    const sampleRate = 8000;
    const bitsPerSample = 16;
    const channels = 1;

    const headerBuffer = Buffer.alloc(44);

    // WAV header
    headerBuffer.write('RIFF', 0);
    headerBuffer.writeUInt32LE(36 + audioBuffer.length, 4);
    headerBuffer.write('WAVE', 8);
    headerBuffer.write('fmt ', 12);
    headerBuffer.writeUInt32LE(16, 16);
    headerBuffer.writeUInt16LE(1, 20);
    headerBuffer.writeUInt16LE(channels, 22);
    headerBuffer.writeUInt32LE(sampleRate, 24);
    headerBuffer.writeUInt32LE(sampleRate * channels * bitsPerSample / 8, 28);
    headerBuffer.writeUInt16LE(channels * bitsPerSample / 8, 32);
    headerBuffer.writeUInt16LE(bitsPerSample, 34);
    headerBuffer.write('data', 36);
    headerBuffer.writeUInt32LE(audioBuffer.length, 40);

    return Buffer.concat([headerBuffer, audioBuffer]);
  }

  /**
   * Process transcription through AI logic
   */
  async processTranscription(ws, callSid, transcription) {
    try {
      const conversationMemory = this.conversationMemory.get(callSid);
      if (!conversationMemory) return;

      // Add user message to memory
      conversationMemory.messages.push({
        role: 'user',
        content: transcription,
        timestamp: Date.now()
      });

      // Get AI response using existing call logic
      const response = await handleCallLogic(transcription, conversationMemory.businessId);

      console.log(`[AI] Generated response for "${transcription}": ${response.text_response.substring(0, 100)}...`);

      // Add AI response to memory
      conversationMemory.messages.push({
        role: 'assistant',
        content: response.text_response,
        intent: response.intent,
        timestamp: Date.now()
      });

      // Convert response to speech and send to caller
      await this.respondWithSpeech(ws, callSid, response.text_response);

    } catch (error) {
      console.error('[AI] Error processing transcription:', error);

      // Send fallback response
      await this.respondWithSpeech(ws, callSid, "I'm sorry, I'm having trouble processing your request. Could you please repeat that?");
    }
  }

  /**
   * Generate speech from text and send to caller
   */
  async respondWithSpeech(ws, callSid, text) {
    try {
      const callSession = this.activeCalls.get(callSid);
      if (!callSession) return;

      console.log(`[TTS] Generating speech for: "${text.substring(0, 50)}..."`);

      // Generate audio
      const audioBuffer = await this.generateSpeechAudio(text);

      if (audioBuffer) {
        // Send to Twilio stream
        this.sendAudioToStream(ws, callSession.streamSid, audioBuffer);
        console.log('[TTS] Audio sent to caller');

        // Keep connection alive by updating last activity
        callSession.lastActivity = Date.now();

        // Add delay to ensure audio is processed before potential stream end
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

    } catch (error) {
      console.error('[TTS] Error generating speech:', error);
    }
  }

  /**
   * Generate speech audio using OpenAI TTS
   */
  async generateSpeechAudio(text) {
    try {
      const mp3Response = await this.openai.audio.speech.create({
        model: 'tts-1',
        voice: 'alloy',
        input: text,
        response_format: 'mp3'
      });

      const audioBuffer = Buffer.from(await mp3Response.arrayBuffer());
      return audioBuffer;

    } catch (error) {
      console.error('[TTS] OpenAI speech generation error:', error);
      return null;
    }
  }

  /**
   * Send audio buffer to Twilio stream in chunks
   */
  sendAudioToStream(ws, streamSid, audioBuffer) {
    try {
      // Send audio in smaller chunks to prevent stream ending
      const chunkSize = 8192; // 8KB chunks
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

          // Send next chunk after small delay
          setTimeout(sendChunk, 20); // 20ms between chunks
        }
      };

      sendChunk();

    } catch (error) {
      console.error('[STREAM] Error sending audio:', error);
    }
  }

  /**
   * Handle stream stop
   */
  async handleStreamStop(data) {
    const { callSid } = data.stop;
    console.log(`[STREAM] Stopping stream for call: ${callSid}`);

    this.cleanupCall(callSid);
  }

  /**
   * Clean up call session data
   */
  cleanupCall(callSid) {
    if (callSid) {
      this.activeCalls.delete(callSid);
      this.audioBuffers.delete(callSid);
      // Keep conversation memory for a while in case of reconnection
      setTimeout(() => {
        this.conversationMemory.delete(callSid);
      }, 300000); // 5 minutes

      console.log(`[STREAM] Cleaned up call session: ${callSid}`);
    }
  }

  /**
   * Get active call statistics
   */
  getStats() {
    return {
      activeCalls: this.activeCalls.size,
      conversationsInMemory: this.conversationMemory.size,
      uptime: process.uptime()
    };
  }

  /**
   * Shut down the streaming service
   */
  shutdown() {
    if (this.wss) {
      this.wss.close(() => {
        console.log('[STREAMING] WebSocket server shut down');
      });
    }

    // Clear all sessions
    this.activeCalls.clear();
    this.audioBuffers.clear();
    this.conversationMemory.clear();
  }
}

module.exports = StreamingVoiceService;