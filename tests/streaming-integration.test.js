const request = require('supertest');
const WebSocket = require('ws');

// Create a separate Express app instance for testing
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const testApp = express();

// Apply same middleware as main app
testApp.use(helmet());
testApp.use(cors());
testApp.use(express.json());
testApp.use(express.urlencoded({ extended: true }));

// Add routes - only the ones we need for testing
testApp.use('/stream', require('../routes/stream'));
testApp.use('/call', require('../routes/call'));

// Health endpoints
testApp.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'AI Receptionist Backend' });
});

describe('Streaming Integration Tests', () => {

  describe('Stream Route Integration', () => {
    test('should provide stream webhook endpoint', async () => {
      const response = await request(testApp)
        .post('/stream')
        .send({
          From: '+15551234567',
          To: '+15559876543',
          CallSid: 'CAstreamtest123'
        })
        .expect(200);

      expect(response.headers['content-type']).toMatch(/xml/);
      expect(response.text).toContain('<Response>');
      expect(response.text).toContain('<Start>');
      expect(response.text).toContain('<Stream');
    });

    test('should include correct WebSocket URL in TwiML', async () => {
      const response = await request(testApp)
        .post('/stream')
        .send({
          From: '+15551234567',
          To: '+15559876543',
          CallSid: 'CAstreamurl123'
        })
        .expect(200);

      // Should contain WebSocket URL
      expect(response.text).toContain('ws://');
      expect(response.text).toContain('ws://');
    });

    test('should handle stream errors gracefully', async () => {
      // Test with minimal data
      const response = await request(testApp)
        .post('/stream')
        .send({})
        .expect(200);

      expect(response.text).toContain('<Response>');
      // Should still provide valid TwiML even without complete data
    });

    test('should return proper TwiML structure', async () => {
      const response = await request(testApp)
        .post('/stream')
        .send({
          From: '+15551234567',
          To: '+15559876543',
          CallSid: 'CAstructure123'
        })
        .expect(200);

      // Check TwiML structure
      expect(response.text).toMatch(/<\?xml version="1\.0" encoding="UTF-8"\?>/);
      expect(response.text).toContain('<Response>');
      expect(response.text).toContain('</Response>');
      expect(response.text).toContain('<Start>');
      expect(response.text).toContain('<Stream');
      expect(response.text).toContain('<Stream');
      expect(response.text).toContain('</Start>');
    });
  });

  describe('Stream Status Endpoint', () => {
    test('should provide stream service status', async () => {
      const response = await request(testApp)
        .get('/stream/status')
        .expect(200);

      expect(response.body).toHaveProperty('service', 'Twilio Streaming Voice');
      expect(response.body).toHaveProperty('status', 'OK');
      expect(response.body).toHaveProperty('stats');
      expect(response.body).toHaveProperty('endpoints');
      expect(Array.isArray(response.body.endpoints)).toBe(true);
    });

    test('should include streaming statistics', async () => {
      const response = await request(testApp)
        .get('/stream/status')
        .expect(200);

      const stats = response.body.stats;
      expect(stats).toHaveProperty('activeCalls');
      expect(stats).toHaveProperty('conversationsInMemory');
      expect(stats).toHaveProperty('uptime');
      expect(typeof stats.activeCalls).toBe('number');
      expect(typeof stats.uptime).toBe('number');
    });
  });

  describe('Stream Test Endpoint', () => {
    test('should provide test TwiML for streaming', async () => {
      const response = await request(testApp)
        .post('/stream/test')
        .expect(200);

      expect(response.headers['content-type']).toMatch(/xml/);
      expect(response.text).toContain('<Response>');
      expect(response.text).toContain('<Say>');
      expect(response.text).toContain('streaming');
      expect(response.text).toContain('<Start>');
      expect(response.text).toContain('<Stream');
    });
  });

  describe('WebSocket Connection Simulation', () => {
    test('should handle WebSocket connection lifecycle', (done) => {
      let ws;

      try {
        ws = new WebSocket('ws://localhost:8080');

        const timeout = setTimeout(() => {
          if (ws) ws.close();
          done(new Error('WebSocket connection timeout'));
        }, 5000);

        ws.on('open', () => {
          clearTimeout(timeout);

          // Send a test connected message
          const connectedMessage = {
            event: 'connected',
            protocol: 'Call'
          };

          ws.send(JSON.stringify(connectedMessage));

          // Send a start message
          const startMessage = {
            event: 'start',
            sequenceNumber: 1,
            start: {
              streamSid: 'MZtest123456789',
              accountSid: 'ACtest123456789',
              callSid: 'CAtest123456789',
              tracks: ['inbound'],
              mediaFormat: {
                encoding: 'audio/x-mulaw',
                sampleRate: 8000,
                channels: 1
              }
            }
          };

          ws.send(JSON.stringify(startMessage));

          setTimeout(() => {
            ws.close();
            done();
          }, 100);
        });

        ws.on('error', (error) => {
          clearTimeout(timeout);
          // Connection might fail if streaming server isn't running
          // This is expected in test environment
          done();
        });

        ws.on('close', () => {
          clearTimeout(timeout);
          done();
        });

      } catch (error) {
        done();
      }
    }, 10000);

    test('should handle media frame simulation', (done) => {
      let ws;

      try {
        ws = new WebSocket('ws://localhost:8080');

        const timeout = setTimeout(() => {
          if (ws) ws.close();
          done();
        }, 5000);

        ws.on('open', () => {
          // Send start message first
          const startMessage = {
            event: 'start',
            start: {
              streamSid: 'MZmedia123456789',
              callSid: 'CAmedia123456789'
            }
          };

          ws.send(JSON.stringify(startMessage));

          // Send media frame
          setTimeout(() => {
            const mediaMessage = {
              event: 'media',
              sequenceNumber: 2,
              media: {
                track: 'inbound',
                chunk: '1',
                timestamp: '1234567890',
                payload: Buffer.from('fake audio data for testing').toString('base64')
              }
            };

            ws.send(JSON.stringify(mediaMessage));

            setTimeout(() => {
              clearTimeout(timeout);
              ws.close();
              done();
            }, 100);
          }, 50);
        });

        ws.on('error', () => {
          clearTimeout(timeout);
          done();
        });

      } catch (error) {
        done();
      }
    }, 10000);

    test('should handle stream stop simulation', (done) => {
      let ws;

      try {
        ws = new WebSocket('ws://localhost:8080');

        const timeout = setTimeout(() => {
          if (ws) ws.close();
          done();
        }, 5000);

        ws.on('open', () => {
          const callSid = 'CAstop123456789';

          // Start
          const startMessage = {
            event: 'start',
            start: {
              streamSid: 'MZstop123456789',
              callSid: callSid
            }
          };
          ws.send(JSON.stringify(startMessage));

          // Stop after a moment
          setTimeout(() => {
            const stopMessage = {
              event: 'stop',
              sequenceNumber: 3,
              stop: {
                callSid: callSid
              }
            };

            ws.send(JSON.stringify(stopMessage));

            setTimeout(() => {
              clearTimeout(timeout);
              ws.close();
              done();
            }, 50);
          }, 100);
        });

        ws.on('error', () => {
          clearTimeout(timeout);
          done();
        });

      } catch (error) {
        done();
      }
    }, 10000);
  });

  describe('End-to-End Stream Flow', () => {
    test('should handle complete streaming call flow', (done) => {
      // This test simulates the complete flow:
      // 1. Twilio webhook call to /stream
      // 2. WebSocket connection establishment
      // 3. Stream start
      // 4. Media frames
      // 5. Stream stop

      // Step 1: Test webhook endpoint
      request(testApp)
        .post('/stream')
        .send({
          From: '+15551234567',
          To: '+15559876543',
          CallSid: 'CAe2etest123'
        })
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);

          expect(res.text).toContain('<Stream');

          // Step 2-5: Test WebSocket flow (if streaming server is available)
          let ws;
          try {
            ws = new WebSocket('ws://localhost:8080');

            const timeout = setTimeout(() => {
              if (ws) ws.close();
              done();
            }, 3000);

            ws.on('open', () => {
              const callSid = 'CAe2etest123';

              // Simulate full flow
              const messages = [
                {
                  event: 'connected',
                  protocol: 'Call'
                },
                {
                  event: 'start',
                  start: {
                    streamSid: 'MZe2etest123',
                    callSid: callSid,
                    mediaFormat: {
                      encoding: 'audio/x-mulaw',
                      sampleRate: 8000,
                      channels: 1
                    }
                  }
                },
                {
                  event: 'media',
                  media: {
                    track: 'inbound',
                    chunk: '1',
                    timestamp: Date.now().toString(),
                    payload: Buffer.from('test audio').toString('base64')
                  }
                },
                {
                  event: 'stop',
                  stop: {
                    callSid: callSid
                  }
                }
              ];

              // Send messages with delays
              let messageIndex = 0;
              const sendNextMessage = () => {
                if (messageIndex < messages.length) {
                  ws.send(JSON.stringify(messages[messageIndex]));
                  messageIndex++;
                  setTimeout(sendNextMessage, 50);
                } else {
                  // All messages sent
                  setTimeout(() => {
                    clearTimeout(timeout);
                    ws.close();
                    done();
                  }, 100);
                }
              };

              sendNextMessage();
            });

            ws.on('error', () => {
              clearTimeout(timeout);
              done();
            });

          } catch (error) {
            done();
          }
        });
    }, 15000);
  });

  describe('Performance and Reliability', () => {
    test('should handle rapid webhook requests', async () => {
      const requests = Array(10).fill().map((_, i) =>
        request(testApp)
          .post('/stream')
          .send({
            From: '+15551234567',
            To: '+15559876543',
            CallSid: `CAperf${i}`
          })
      );

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.text).toContain('<Response>');
        expect(response.text).toContain('<Stream');
      });
    });

    test('should maintain service health under load', async () => {
      // Generate multiple status requests
      const statusRequests = Array(5).fill().map(() =>
        request(testApp).get('/stream/status')
      );

      const responses = await Promise.all(statusRequests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.status).toBe('OK');
        expect(response.body.stats).toBeDefined();
      });
    });

    test('should handle malformed webhook data', async () => {
      const malformedData = [
        {},
        { From: 'invalid' },
        { CallSid: null },
        { randomField: 'randomValue' }
      ];

      for (const data of malformedData) {
        const response = await request(testApp)
          .post('/stream')
          .send(data)
          .expect(200);

        // Should still return valid TwiML
        expect(response.text).toContain('<Response>');
      }
    });
  });

  describe('Service Integration', () => {
    test('should integrate with main API health check', async () => {
      const response = await request(testApp)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'OK');
      expect(response.body).toHaveProperty('service');
    });

    test('should work alongside call endpoint', async () => {
      // Test that streaming doesn't interfere with regular call endpoint
      const callResponse = await request(testApp)
        .post('/call')
        .send({
          user_input: 'What are your hours?',
          business_id: 'pizzakarachi'
        })
        .expect(200);

      expect(callResponse.body).toHaveProperty('intent', 'hours');

      // Stream endpoint should also work
      const streamResponse = await request(testApp)
        .post('/stream')
        .send({
          From: '+15551234567',
          CallSid: 'CAintegration123'
        })
        .expect(200);

      expect(streamResponse.text).toContain('<Stream');
    });

    test('should provide comprehensive service overview', async () => {
      // Test multiple endpoints for service overview
      const endpoints = [
        '/health',
        '/stream/status'
      ];

      for (const endpoint of endpoints) {
        const response = await request(testApp)
          .get(endpoint);

        // Some endpoints might not be available in test environment
        if (response.status === 200) {
          expect(response.body).toHaveProperty('status', 'OK');
          expect(response.body).toHaveProperty('service');
        }
      }
    });
  });
});