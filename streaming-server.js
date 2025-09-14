#!/usr/bin/env node

/**
 * Real-time Streaming Voice AI Server
 *
 * This is a separate server process that handles WebSocket connections
 * for real-time voice streaming with Twilio.
 *
 * Usage:
 *   node streaming-server.js
 *
 * The server will start on port 8080 and handle:
 * - WebSocket connections from Twilio Stream
 * - Real-time audio processing
 * - Speech-to-text via OpenAI Whisper
 * - AI response generation
 * - Text-to-speech streaming back to caller
 */

require('dotenv').config();

const StreamingVoiceService = require('./services/streamingVoice');

class StreamingServer {
  constructor() {
    this.streamingService = new StreamingVoiceService();
    this.port = process.env.STREAM_PORT || 8080;
    this.isShuttingDown = false;
  }

  async start() {
    try {
      console.log('🎙️  Starting AI Receptionist Streaming Server...');
      console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);

      // Verify required environment variables
      this.checkEnvironment();

      // Start the WebSocket server
      this.streamingService.startWebSocketServer(this.port);

      console.log(`🚀 Streaming server ready!`);
      console.log(`📞 WebSocket endpoint: ws://localhost:${this.port}`);
      console.log(`🔧 Configure Twilio Stream webhook to: ws://your-domain:${this.port}`);
      console.log(`💡 Use ngrok for local development: ngrok http ${this.port}`);
      console.log(`📊 Health: GET http://localhost:3001/stream/status`);

      // Setup graceful shutdown
      this.setupShutdown();

      // Log periodic stats
      this.startStatsLogging();

    } catch (error) {
      console.error('❌ Failed to start streaming server:', error);
      process.exit(1);
    }
  }

  checkEnvironment() {
    const required = ['OPENAI_API_KEY'];
    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
      console.warn(`⚠️  Missing environment variables: ${missing.join(', ')}`);
      console.warn('🔧 Some features may not work properly');
    }

    if (process.env.OPENAI_API_KEY) {
      console.log('✅ OpenAI API key configured (Whisper STT + TTS)');
    }

    if (process.env.ELEVENLABS_API_KEY) {
      console.log('✅ ElevenLabs API key configured (Premium TTS)');
    } else {
      console.log('ℹ️  Using OpenAI TTS (ElevenLabs not configured)');
    }
  }

  setupShutdown() {
    const shutdown = (signal) => {
      if (this.isShuttingDown) return;
      this.isShuttingDown = true;

      console.log(`\n📴 Received ${signal}, shutting down streaming server...`);

      // Stop accepting new connections
      if (this.streamingService) {
        this.streamingService.shutdown();
      }

      // Give existing connections time to close
      setTimeout(() => {
        console.log('👋 Streaming server shutdown complete');
        process.exit(0);
      }, 5000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGHUP', () => shutdown('SIGHUP'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('❌ Uncaught Exception:', error);
      shutdown('EXCEPTION');
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
      shutdown('REJECTION');
    });
  }

  startStatsLogging() {
    // Log stats every 5 minutes
    setInterval(() => {
      if (!this.isShuttingDown && this.streamingService) {
        const stats = this.streamingService.getStats();
        console.log(`📊 Stats - Active calls: ${stats.activeCalls}, Memory: ${stats.conversationsInMemory}, Uptime: ${Math.floor(stats.uptime)}s`);
      }
    }, 300000); // 5 minutes
  }
}

// Start the server if this file is run directly
if (require.main === module) {
  const server = new StreamingServer();
  server.start().catch(console.error);
}

module.exports = StreamingServer;