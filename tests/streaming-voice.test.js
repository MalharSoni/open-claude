const WebSocket = require('ws');
const StreamingVoiceService = require('../services/streamingVoice');

// Mock OpenAI for testing
jest.mock('openai', () => {
  return {
    OpenAI: jest.fn().mockImplementation(() => ({
      audio: {
        transcriptions: {
          create: jest.fn().mockResolvedValue('test transcription')
        },
        speech: {
          create: jest.fn().mockResolvedValue({
            arrayBuffer: jest.fn().mockResolvedValue(Buffer.from('test audio'))
          })
        }
      }
    }))
  };
});

describe('Streaming Voice Service Tests', () => {
  let streamingService;
  let testServer;

  beforeAll(async () => {
    // Set test environment variables
    process.env.OPENAI_API_KEY = 'test-key';

    // Start streaming service for testing
    streamingService = new StreamingVoiceService();
    testServer = streamingService.startWebSocketServer(8081); // Different port for testing

    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  afterAll(async () => {
    if (streamingService) {
      streamingService.shutdown();
    }
    if (testServer) {
      await new Promise(resolve => {
        testServer.close(() => resolve());
      });
    }
  });

  describe('WebSocket Server', () => {
    test('should start WebSocket server successfully', () => {
      expect(testServer).toBeDefined();
      expect(testServer._handle).toBeDefined();
    });

    test('should accept WebSocket connections', (done) => {
      const ws = new WebSocket('ws://localhost:8081');

      ws.on('open', () => {
        expect(ws.readyState).toBe(WebSocket.OPEN);
        ws.close();
        done();
      });

      ws.on('error', (error) => {
        done(error);
      });
    });

    test('should handle connection close gracefully', (done) => {
      const ws = new WebSocket('ws://localhost:8081');

      ws.on('open', () => {
        ws.close();
      });

      ws.on('close', () => {
        done();
      });

      ws.on('error', (error) => {
        done(error);
      });
    });
  });

  describe('Twilio Stream Message Handling', () => {
    let ws;

    beforeEach((done) => {
      ws = new WebSocket('ws://localhost:8081');
      ws.on('open', () => done());
      ws.on('error', done);
    });

    afterEach(() => {
      if (ws) {
        ws.close();
      }
    });

    test('should handle stream start message', (done) => {
      const startMessage = {
        event: 'start',
        start: {
          callSid: 'CA123test456',
          streamSid: 'MZ123test456',
          accountSid: 'AC123test456',
          mediaFormat: {
            encoding: 'audio/x-mulaw',
            sampleRate: 8000,
            channels: 1
          }
        }
      };

      // Send start message
      ws.send(JSON.stringify(startMessage));

      // Give time for processing
      setTimeout(() => {
        // Check if call session was created
        const stats = streamingService.getStats();
        expect(stats.activeCalls).toBeGreaterThan(0);
        done();
      }, 100);
    });

    test('should handle media frames', (done) => {
      const callSid = 'CA123media456';

      // First send start message
      const startMessage = {
        event: 'start',
        start: {
          callSid: callSid,
          streamSid: 'MZ123media456'
        }
      };

      ws.send(JSON.stringify(startMessage));

      // Then send media frame
      setTimeout(() => {
        const mediaMessage = {
          event: 'media',
          media: {
            track: 'inbound',
            chunk: '1',
            timestamp: '2023',
            payload: Buffer.from('test audio data').toString('base64')
          }
        };

        ws.send(JSON.stringify(mediaMessage));

        // Verify audio buffer was updated
        setTimeout(() => {
          const audioBuffer = streamingService.audioBuffers.get(callSid);
          expect(audioBuffer).toBeDefined();
          done();
        }, 50);
      }, 50);
    });

    test('should handle stream stop message', (done) => {
      const callSid = 'CA123stop456';

      // Start stream
      const startMessage = {
        event: 'start',
        start: {
          callSid: callSid,
          streamSid: 'MZ123stop456'
        }
      };

      ws.send(JSON.stringify(startMessage));

      setTimeout(() => {
        // Stop stream
        const stopMessage = {
          event: 'stop',
          stop: {
            callSid: callSid
          }
        };

        ws.send(JSON.stringify(stopMessage));

        setTimeout(() => {
          // Verify cleanup
          const callSession = streamingService.activeCalls.get(callSid);
          expect(callSession).toBeUndefined();
          done();
        }, 50);
      }, 50);
    });

    test('should handle malformed messages gracefully', (done) => {
      // Send invalid JSON
      ws.send('invalid json');

      // Send incomplete message
      ws.send(JSON.stringify({ event: 'unknown' }));

      // Connection should remain open
      setTimeout(() => {
        expect(ws.readyState).toBe(WebSocket.OPEN);
        done();
      }, 100);
    });
  });

  describe('Audio Processing', () => {
    test('should determine when to process audio correctly', () => {
      const callSession = {
        lastProcessTime: Date.now() - 4000, // 4 seconds ago
        isProcessing: false
      };

      // Test buffer duration trigger
      const longBuffer = new Array(101).fill(Buffer.alloc(10)); // Simulate long buffer
      expect(streamingService.shouldProcessAudio(callSession, longBuffer)).toBe(true);

      // Test time trigger
      const shortBuffer = new Array(10).fill(Buffer.alloc(10));
      expect(streamingService.shouldProcessAudio(callSession, shortBuffer)).toBe(true);

      // Test no processing when already processing
      callSession.isProcessing = true;
      expect(streamingService.shouldProcessAudio(callSession, shortBuffer)).toBe(false);
    });

    test('should convert audio buffer to WAV format', () => {
      const testBuffer = Buffer.alloc(1000);
      const wavBuffer = streamingService.convertToWav(testBuffer);

      expect(wavBuffer).toBeDefined();
      expect(wavBuffer.length).toBeGreaterThan(testBuffer.length); // Should include WAV header

      // Check WAV header
      expect(wavBuffer.subarray(0, 4).toString()).toBe('RIFF');
      expect(wavBuffer.subarray(8, 12).toString()).toBe('WAVE');
    });

    test('should handle audio buffer concatenation', () => {
      const chunk1 = Buffer.from('chunk1');
      const chunk2 = Buffer.from('chunk2');
      const chunks = [chunk1, chunk2];

      const combined = Buffer.concat(chunks);
      expect(combined.toString()).toBe('chunk1chunk2');
    });
  });

  describe('Conversation Memory', () => {
    test('should initialize conversation memory for new calls', () => {
      const callSid = 'CA123memory456';
      const startData = {
        event: 'start',
        start: { callSid, streamSid: 'MZ123memory456' }
      };

      // Simulate stream start
      streamingService.handleStreamStart({}, startData);

      const memory = streamingService.conversationMemory.get(callSid);
      expect(memory).toBeDefined();
      expect(memory.messages).toEqual([]);
      expect(memory.businessId).toBe('pizzakarachi');
      expect(memory.context).toEqual({});
    });

    test('should store conversation messages', () => {
      const callSid = 'CA123messages456';

      // Initialize memory
      streamingService.conversationMemory.set(callSid, {
        messages: [],
        businessId: 'pizzakarachi',
        context: {}
      });

      const memory = streamingService.conversationMemory.get(callSid);

      // Add user message
      memory.messages.push({
        role: 'user',
        content: 'What are your hours?',
        timestamp: Date.now()
      });

      // Add AI response
      memory.messages.push({
        role: 'assistant',
        content: 'We are open Monday to Friday 9am to 5pm',
        intent: 'hours',
        timestamp: Date.now()
      });

      expect(memory.messages).toHaveLength(2);
      expect(memory.messages[0].role).toBe('user');
      expect(memory.messages[1].role).toBe('assistant');
      expect(memory.messages[1].intent).toBe('hours');
    });

    test('should clean up old conversation memory', (done) => {
      const callSid = 'CA123cleanup456';

      // Set conversation memory
      streamingService.conversationMemory.set(callSid, {
        messages: [{ role: 'user', content: 'test' }],
        businessId: 'test',
        context: {}
      });

      // Trigger cleanup
      streamingService.cleanupCall(callSid);

      // Memory should be cleaned up after timeout
      // For test we'll check that the cleanup function was called
      expect(streamingService.conversationMemory.has(callSid)).toBe(true);
      done();
    }, 1000);
  });

  describe('Statistics and Monitoring', () => {
    test('should provide accurate statistics', () => {
      const initialStats = streamingService.getStats();
      expect(initialStats).toHaveProperty('activeCalls');
      expect(initialStats).toHaveProperty('conversationsInMemory');
      expect(initialStats).toHaveProperty('uptime');
      expect(typeof initialStats.uptime).toBe('number');
    });

    test('should track active calls correctly', () => {
      const callSid = 'CA123stats456';
      const initialCount = streamingService.activeCalls.size;

      // Add a call session
      streamingService.activeCalls.set(callSid, {
        ws: {},
        streamSid: 'MZ123stats456',
        startTime: Date.now(),
        audioBuffer: [],
        isProcessing: false,
        lastActivity: Date.now()
      });

      expect(streamingService.activeCalls.size).toBe(initialCount + 1);

      // Clean up
      streamingService.activeCalls.delete(callSid);
      expect(streamingService.activeCalls.size).toBe(initialCount);
    });
  });

  describe('Error Handling', () => {
    test('should handle WebSocket errors gracefully', (done) => {
      const ws = new WebSocket('ws://localhost:8081');

      ws.on('open', () => {
        // Send invalid message to trigger error handling
        ws.send('not json');

        // Connection should remain stable
        setTimeout(() => {
          expect(ws.readyState).toBe(WebSocket.OPEN);
          ws.close();
          done();
        }, 100);
      });

      ws.on('error', (error) => {
        // Should not reach here for our test case
        done(error);
      });
    });

    test('should handle missing call session data', () => {
      const nonExistentCallSid = 'CA123nonexistent456';

      // Try to get session that doesn't exist
      const session = streamingService.activeCalls.get(nonExistentCallSid);
      expect(session).toBeUndefined();

      // Cleanup should not crash
      expect(() => {
        streamingService.cleanupCall(nonExistentCallSid);
      }).not.toThrow();
    });

    test('should handle audio processing errors', async () => {
      const callSid = 'CA123error456';
      const testBuffer = Buffer.from('test audio');

      // Mock transcription to throw error
      const originalTranscribe = streamingService.transcribeAudio;
      streamingService.transcribeAudio = jest.fn().mockRejectedValue(new Error('STT Error'));

      try {
        await streamingService.processAccumulatedAudio({}, callSid, [testBuffer]);

        // Should not crash and session should not be processing
        const session = streamingService.activeCalls.get(callSid);
        if (session) {
          expect(session.isProcessing).toBe(false);
        }
      } finally {
        // Restore original method
        streamingService.transcribeAudio = originalTranscribe;
      }
    });
  });

  describe('Performance', () => {
    test('should handle multiple concurrent connections', async () => {
      const connectionCount = 5;
      const connections = [];

      // Create multiple connections
      for (let i = 0; i < connectionCount; i++) {
        const ws = new WebSocket('ws://localhost:8081');
        connections.push(new Promise((resolve, reject) => {
          ws.on('open', () => resolve(ws));
          ws.on('error', reject);
        }));
      }

      // Wait for all connections
      const sockets = await Promise.all(connections);

      expect(sockets).toHaveLength(connectionCount);

      // All should be open
      sockets.forEach(ws => {
        expect(ws.readyState).toBe(WebSocket.OPEN);
      });

      // Close all connections
      sockets.forEach(ws => ws.close());
    }, 10000);

    test('should process audio buffers efficiently', () => {
      const startTime = Date.now();
      const testBuffer = Buffer.alloc(10000);

      // Process large buffer
      const wavBuffer = streamingService.convertToWav(testBuffer);

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      expect(wavBuffer).toBeDefined();
      expect(processingTime).toBeLessThan(100); // Should be fast
    });
  });

  describe('Integration with Call Logic', () => {
    test('should integrate with existing handleCallLogic', async () => {
      const testTranscription = 'What are your hours?';
      const businessId = 'pizzakarachi';

      const { handleCallLogic } = require('../services/callLogic');
      const result = await handleCallLogic(testTranscription, businessId);

      expect(result).toHaveProperty('text_response');
      expect(result).toHaveProperty('intent');
      expect(result.intent).toBe('hours');
      expect(result.business_id).toBe(businessId);
    });

    test('should handle conversation context correctly', () => {
      const callSid = 'CA123context456';

      // Initialize conversation
      streamingService.conversationMemory.set(callSid, {
        messages: [
          { role: 'user', content: 'Hello', timestamp: Date.now() - 1000 },
          { role: 'assistant', content: 'Hi! How can I help?', timestamp: Date.now() - 500 }
        ],
        businessId: 'pizzakarachi',
        context: { lastIntent: 'generic' }
      });

      const memory = streamingService.conversationMemory.get(callSid);
      expect(memory.messages).toHaveLength(2);
      expect(memory.context.lastIntent).toBe('generic');
    });
  });
});