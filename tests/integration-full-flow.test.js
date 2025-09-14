const request = require('supertest');
const app = require('../index');
const fs = require('fs');
const path = require('path');

describe('Full Integration Flow Tests', () => {
  const testBusinessId = 'full-integration-test';
  const testBusinessData = {
    name: 'Full Integration Test Restaurant',
    phone: '(555) 111-2222',
    address: '999 Integration St, Test City, TC 99999',
    hours: {
      monday: '7am–10pm',
      tuesday: '7am–10pm',
      wednesday: '7am–10pm',
      thursday: '7am–10pm',
      friday: '7am–11pm',
      saturday: '8am–11pm',
      sunday: '8am–9pm'
    },
    services: [
      {
        name: 'Integration Special',
        description: 'Full stack testing special',
        price: 99.99,
        duration: 120
      },
      {
        name: 'API Combo',
        description: 'Complete API testing meal',
        price: 49.99,
        duration: 60
      }
    ],
    delivery: {
      available: true,
      areas: ['Test Zone A', 'Test Zone B', 'Integration District'],
      fee: 4.99,
      minimum: 25.00
    },
    payment_methods: ['cash', 'credit', 'debit', 'crypto', 'app'],
    special_notes: {
      halal: 'Certified halal kitchen',
      vegetarian: 'Extensive vegan and vegetarian options',
      gluten_free: 'Gluten-free menu available'
    }
  };

  beforeAll(() => {
    // Ensure clean environment
    const filePath = path.join(__dirname, '..', 'data', `${testBusinessId}.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  });

  afterAll(() => {
    // Clean up all test files and audio
    const filePath = path.join(__dirname, '..', 'data', `${testBusinessId}.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    const audioDir = path.join(__dirname, '..', 'public', 'audio');
    if (fs.existsSync(audioDir)) {
      const files = fs.readdirSync(audioDir);
      files.forEach(file => {
        if (file.includes(testBusinessId)) {
          fs.unlinkSync(path.join(audioDir, file));
        }
      });
    }
  });

  describe('Complete Business Onboarding Flow', () => {
    test('Flow 1: Upload Business → Test Responses → Voice Integration', async () => {
      // Step 1: Upload business data (Dashboard → API)
      const uploadResponse = await request(app)
        .post(`/api/business/${testBusinessId}`)
        .send(testBusinessData)
        .expect(200);

      expect(uploadResponse.body.success).toBe(true);
      expect(uploadResponse.body.business_id).toBe(testBusinessId);

      // Step 2: Verify business appears in list (Dashboard loading)
      const listResponse = await request(app)
        .get('/api/businesses')
        .expect(200);

      const ourBusiness = listResponse.body.businesses.find(
        b => b.business_id === testBusinessId
      );
      expect(ourBusiness).toBeDefined();
      expect(ourBusiness.name).toBe(testBusinessData.name);

      // Step 3: Test all intents with the new business (Dashboard testing)
      const testQueries = [
        { query: 'What are your hours?', expectedIntent: 'hours' },
        { query: 'Do you deliver to Test Zone A?', expectedIntent: 'delivery' },
        { query: 'What services do you offer?', expectedIntent: 'menu' },
        { query: 'Where are you located?', expectedIntent: 'location' },
        { query: 'Is your food halal?', expectedIntent: 'halal' },
        { query: 'What payment methods do you accept?', expectedIntent: 'payment' },
        { query: 'Can I make a reservation?', expectedIntent: 'booking' },
        { query: 'Hello there!', expectedIntent: 'generic' }
      ];

      for (const test of testQueries) {
        const response = await request(app)
          .post('/call')
          .send({
            user_input: test.query,
            business_id: testBusinessId
          })
          .expect(200);

        expect(response.body.intent).toBe(test.expectedIntent);
        expect(response.body.text_response.length).toBeGreaterThan(0);
        expect(response.body.business_id).toBe(testBusinessId);
      }

      // Step 4: Test Voice webhook with same business (Twilio integration)
      const voiceResponse = await request(app)
        .post('/voice')
        .send({
          From: '+15551112222',
          To: '+15559998888',
          SpeechResult: 'What are your hours?',
          CallSid: 'CAintegrationtest123'
        })
        .expect(200);

      expect(voiceResponse.headers['content-type']).toMatch(/xml/);
      expect(voiceResponse.text).toContain('<Response>');

      // Should contain business-specific information
      if (voiceResponse.text.includes('<Say>')) {
        expect(voiceResponse.text).toContain('7am–10pm');
      }
    });

    test('Flow 2: Multi-Business Environment Testing', async () => {
      // Create multiple businesses
      const businesses = [
        { id: 'pizza-place', name: 'Test Pizza Place', specialty: 'pizza' },
        { id: 'burger-joint', name: 'Test Burger Joint', specialty: 'burgers' },
        { id: 'sushi-bar', name: 'Test Sushi Bar', specialty: 'sushi' }
      ];

      // Upload all businesses
      for (const biz of businesses) {
        const bizData = {
          ...testBusinessData,
          name: biz.name,
          services: [{
            name: `${biz.specialty} special`,
            description: `Our famous ${biz.specialty}`,
            price: 15.99
          }]
        };

        await request(app)
          .post(`/api/business/${biz.id}`)
          .send(bizData)
          .expect(200);
      }

      // Test each business maintains separate identity
      for (const biz of businesses) {
        const response = await request(app)
          .post('/call')
          .send({
            user_input: 'What services do you offer?',
            business_id: biz.id
          })
          .expect(200);

        expect(response.body.text_response).toContain(biz.specialty);
        expect(response.body.business_id).toBe(biz.id);
      }

      // Clean up test businesses
      for (const biz of businesses) {
        await request(app)
          .delete(`/api/business/${biz.id}`)
          .expect(200);
      }
    });

    test('Flow 3: Audio Generation and Playback Pipeline', async () => {
      const originalProvider = process.env.TTS_PROVIDER;
      process.env.TTS_PROVIDER = 'open_source';

      try {
        // Ensure business exists
        await request(app)
          .post(`/api/business/${testBusinessId}`)
          .send(testBusinessData);

        // Generate audio through call endpoint
        const callResponse = await request(app)
          .post('/call')
          .send({
            user_input: 'What are your hours?',
            business_id: testBusinessId
          })
          .expect(200);

        if (callResponse.body.audio_available) {
          expect(callResponse.body.audio_url).toBeDefined();
          expect(callResponse.body.audio_url_relative).toBeDefined();
          expect(callResponse.body.audio).toBeDefined();

          // Test audio file accessibility
          const audioResponse = await request(app)
            .get(callResponse.body.audio_url_relative)
            .expect(200);

          expect(audioResponse.headers['content-type']).toMatch(/audio/);

          // Test Voice endpoint uses same audio generation
          const voiceResponse = await request(app)
            .post('/voice')
            .send({
              From: '+15551112222',
              To: '+15559998888',
              SpeechResult: 'What are your hours?',
              CallSid: 'CAaudiotest123'
            })
            .expect(200);

          // Should include Play tag for audio or Say tag for fallback
          const hasAudioTag = voiceResponse.text.includes('<Play>') ||
                             voiceResponse.text.includes('<Say>');
          expect(hasAudioTag).toBe(true);
        }
      } finally {
        process.env.TTS_PROVIDER = originalProvider;
      }
    });
  });

  describe('Error Recovery and Edge Cases', () => {
    test('Should handle business deletion and re-creation gracefully', async () => {
      // Create business
      await request(app)
        .post(`/api/business/${testBusinessId}`)
        .send(testBusinessData)
        .expect(200);

      // Test business works
      await request(app)
        .post('/call')
        .send({
          user_input: 'Hello',
          business_id: testBusinessId
        })
        .expect(200);

      // Delete business
      await request(app)
        .delete(`/api/business/${testBusinessId}`)
        .expect(200);

      // Test business no longer works
      await request(app)
        .post('/call')
        .send({
          user_input: 'Hello',
          business_id: testBusinessId
        })
        .expect(404);

      // Re-create business
      await request(app)
        .post(`/api/business/${testBusinessId}`)
        .send(testBusinessData)
        .expect(200);

      // Test business works again
      await request(app)
        .post('/call')
        .send({
          user_input: 'Hello',
          business_id: testBusinessId
        })
        .expect(200);
    });

    test('Should handle concurrent operations without conflicts', async () => {
      // Create business
      await request(app)
        .post(`/api/business/${testBusinessId}`)
        .send(testBusinessData);

      // Run multiple concurrent operations
      const operations = [
        // Multiple API calls
        request(app).post('/call').send({ user_input: 'Hours?', business_id: testBusinessId }),
        request(app).post('/call').send({ user_input: 'Delivery?', business_id: testBusinessId }),
        request(app).post('/call').send({ user_input: 'Location?', business_id: testBusinessId }),

        // Voice calls
        request(app).post('/voice').send({
          From: '+1555001',
          SpeechResult: 'Menu?',
          CallSid: 'CA001'
        }),
        request(app).post('/voice').send({
          From: '+1555002',
          SpeechResult: 'Hours?',
          CallSid: 'CA002'
        }),

        // Business list requests
        request(app).get('/api/businesses'),
        request(app).get('/api/businesses'),

        // Health checks
        request(app).get('/api/health'),
        request(app).get('/voice/health')
      ];

      const results = await Promise.all(operations);

      // All operations should complete successfully
      results.forEach((result, index) => {
        expect(result.status).toBeGreaterThanOrEqual(200);
        expect(result.status).toBeLessThan(500);
      });
    });

    test('Should maintain data integrity under load', async () => {
      // Create business
      await request(app)
        .post(`/api/business/${testBusinessId}`)
        .send(testBusinessData);

      // Rapid-fire tests to ensure data consistency
      const rapidTests = Array(50).fill().map((_, i) =>
        request(app)
          .post('/call')
          .send({
            user_input: `Test ${i}: What are your hours?`,
            business_id: testBusinessId
          })
      );

      const results = await Promise.all(rapidTests);

      // All should return consistent data
      results.forEach((result, index) => {
        expect(result.status).toBe(200);
        expect(result.body.intent).toBe('hours');
        expect(result.body.business_id).toBe(testBusinessId);
        expect(result.body.text_response).toContain('7am–10pm');
      });
    });
  });

  describe('System Health and Monitoring', () => {
    test('All health endpoints should be operational', async () => {
      const healthEndpoints = [
        '/health',
        '/api/health',
        '/voice/health'
      ];

      for (const endpoint of healthEndpoints) {
        const response = await request(app)
          .get(endpoint)
          .expect(200);

        expect(response.body).toHaveProperty('status', 'OK');
        expect(response.body).toHaveProperty('service');
      }
    });

    test('Audio management system should be functional', async () => {
      // Test audio info
      const infoResponse = await request(app)
        .get('/audio/info')
        .expect(200);

      expect(infoResponse.body).toHaveProperty('totalFiles');
      expect(infoResponse.body).toHaveProperty('totalSize');

      // Test audio cleanup
      const cleanupResponse = await request(app)
        .get('/audio/cleanup')
        .expect(200);

      expect(cleanupResponse.body).toHaveProperty('filesRemoved');
      expect(cleanupResponse.body).toHaveProperty('spaceFreed');
    });

    test('System should handle resource limits gracefully', async () => {
      // Test with very long text
      const longText = 'This is a very long text input that might challenge the system. '.repeat(100);

      await request(app)
        .post(`/api/business/${testBusinessId}`)
        .send(testBusinessData);

      const response = await request(app)
        .post('/call')
        .send({
          user_input: longText,
          business_id: testBusinessId
        })
        .expect(200);

      expect(response.body).toHaveProperty('text_response');
      expect(response.body).toHaveProperty('intent');
    });
  });

  describe('Performance Benchmarks', () => {
    test('API response times should be within acceptable limits', async () => {
      await request(app)
        .post(`/api/business/${testBusinessId}`)
        .send(testBusinessData);

      const testCases = [
        { endpoint: '/call', method: 'POST', data: { user_input: 'Hours?', business_id: testBusinessId }},
        { endpoint: '/api/businesses', method: 'GET' },
        { endpoint: '/voice', method: 'POST', data: { SpeechResult: 'Hello', CallSid: 'PERF001' }}
      ];

      for (const testCase of testCases) {
        const startTime = Date.now();

        let response;
        if (testCase.method === 'POST') {
          response = await request(app).post(testCase.endpoint).send(testCase.data);
        } else {
          response = await request(app).get(testCase.endpoint);
        }

        const responseTime = Date.now() - startTime;

        expect(response.status).toBeGreaterThanOrEqual(200);
        expect(response.status).toBeLessThan(500);
        expect(responseTime).toBeLessThan(5000); // 5 second timeout
      }
    });

    test('System should handle batch operations efficiently', async () => {
      // Create multiple businesses in batch
      const batchBusinesses = Array(10).fill().map((_, i) => ({
        id: `batch-test-${i}`,
        data: { ...testBusinessData, name: `Batch Test Business ${i}` }
      }));

      const startTime = Date.now();

      // Create all businesses
      await Promise.all(
        batchBusinesses.map(biz =>
          request(app)
            .post(`/api/business/${biz.id}`)
            .send(biz.data)
        )
      );

      // Test all businesses
      const testResults = await Promise.all(
        batchBusinesses.map(biz =>
          request(app)
            .post('/call')
            .send({
              user_input: 'What are your hours?',
              business_id: biz.id
            })
        )
      );

      const totalTime = Date.now() - startTime;

      // All operations should complete in reasonable time
      expect(totalTime).toBeLessThan(15000); // 15 seconds for batch operations

      // All tests should pass
      testResults.forEach(result => {
        expect(result.status).toBe(200);
        expect(result.body.intent).toBe('hours');
      });

      // Clean up
      await Promise.all(
        batchBusinesses.map(biz =>
          request(app).delete(`/api/business/${biz.id}`)
        )
      );
    });
  });
});