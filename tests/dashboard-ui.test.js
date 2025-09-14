/**
 * UI/UX Dashboard Tests
 *
 * These tests verify the dashboard functionality through API endpoints
 * since we can't run browser automation tests without additional setup.
 *
 * For full UI testing, consider using:
 * - Playwright: npm install --save-dev @playwright/test
 * - Cypress: npm install --save-dev cypress
 * - Puppeteer: npm install --save-dev puppeteer
 */

const request = require('supertest');
const app = require('../index');
const fs = require('fs');
const path = require('path');

describe('Dashboard Integration Tests', () => {

  describe('Dashboard Static Files', () => {
    test('should serve dashboard HTML at root path', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      expect(response.headers['content-type']).toMatch(/html/);
      expect(response.text).toContain('AI Receptionist Dashboard');
      expect(response.text).toContain('Upload Business Data');
      expect(response.text).toContain('Test AI Responses');
    });

    test('should include all necessary UI components', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      // Check for key UI elements
      expect(response.text).toContain('businessId');
      expect(response.text).toContain('fileUpload');
      expect(response.text).toContain('jsonInput');
      expect(response.text).toContain('uploadBtn');
      expect(response.text).toContain('testBtn');
      expect(response.text).toContain('question-btn');
      expect(response.text).toContain('responseArea');
      expect(response.text).toContain('audioPlayer');
      expect(response.text).toContain('logsTable');
    });

    test('should include necessary JavaScript functions', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      // Check for key JavaScript functions
      expect(response.text).toContain('handleFileUpload');
      expect(response.text).toContain('testAIResponse');
      expect(response.text).toContain('loadBusinesses');
      expect(response.text).toContain('updateLogsTable');
      expect(response.text).toContain('showStatus');
    });

    test('should have proper CSS styling', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      // Check for CSS classes and styling
      expect(response.text).toContain('dashboard-grid');
      expect(response.text).toContain('card');
      expect(response.text).toContain('form-group');
      expect(response.text).toContain('file-upload');
      expect(response.text).toContain('question-buttons');
      expect(response.text).toContain('response-area');
      expect(response.text).toContain('logs-table');
    });

    test('should be mobile responsive', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      // Check for responsive design elements
      expect(response.text).toContain('@media (max-width: 768px)');
      expect(response.text).toContain('grid-template-columns: 1fr');
    });
  });

  describe('Dashboard API Integration Flow', () => {
    const testBusinessId = 'dashboard-test-business';
    const testBusinessData = {
      name: 'Dashboard Test Restaurant',
      phone: '(555) 555-5555',
      address: '789 Dashboard Ave, Test City, TC 54321',
      hours: {
        monday: '9am–9pm',
        tuesday: '9am–9pm',
        wednesday: '9am–9pm',
        thursday: '9am–9pm',
        friday: '9am–10pm',
        saturday: '10am–10pm',
        sunday: '11am–8pm'
      },
      services: [
        {
          name: 'Dashboard Special',
          description: 'Special dish for testing',
          price: 15.99,
          duration: 30
        }
      ],
      delivery: {
        available: true,
        areas: ['Dashboard District', 'UI/UX Zone'],
        fee: 2.99,
        minimum: 12.00
      },
      payment_methods: ['cash', 'credit', 'debit', 'app'],
      special_notes: {
        halal: 'Halal options available',
        vegetarian: 'Full vegetarian menu'
      }
    };

    afterAll(() => {
      // Clean up test business file
      const filePath = path.join(__dirname, '..', 'data', `${testBusinessId}.json`);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      // Clean up audio files
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

    describe('Business Upload Workflow', () => {
      test('should save business data via API (simulating dashboard upload)', async () => {
        const response = await request(app)
          .post(`/api/business/${testBusinessId}`)
          .send(testBusinessData)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.business_id).toBe(testBusinessId);

        // Verify file was created
        const filePath = path.join(__dirname, '..', 'data', `${testBusinessId}.json`);
        expect(fs.existsSync(filePath)).toBe(true);
      });

      test('should load business list for dropdown (simulating dashboard load)', async () => {
        const response = await request(app)
          .get('/api/businesses')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.businesses).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              business_id: testBusinessId,
              name: testBusinessData.name
            })
          ])
        );
      });
    });

    describe('AI Response Testing Workflow', () => {
      beforeAll(async () => {
        // Ensure test business exists
        await request(app)
          .post(`/api/business/${testBusinessId}`)
          .send(testBusinessData);
      });

      test('should test hours query (simulating dashboard question button)', async () => {
        const response = await request(app)
          .post('/call')
          .send({
            user_input: 'What are your hours?',
            business_id: testBusinessId
          })
          .expect(200);

        expect(response.body.intent).toBe('hours');
        expect(response.body.text_response).toContain('9am–9pm');
        expect(response.body).toHaveProperty('audio_available');
      });

      test('should test delivery query (simulating dashboard question button)', async () => {
        const response = await request(app)
          .post('/call')
          .send({
            user_input: 'Do you deliver to Dashboard District?',
            business_id: testBusinessId
          })
          .expect(200);

        expect(response.body.intent).toBe('delivery');
        expect(response.body.text_response).toContain('Dashboard District');
      });

      test('should test menu query (simulating dashboard question button)', async () => {
        const response = await request(app)
          .post('/call')
          .send({
            user_input: 'What services do you offer?',
            business_id: testBusinessId
          })
          .expect(200);

        expect(response.body.intent).toBe('menu');
        expect(response.body.text_response).toContain('Dashboard Special');
      });

      test('should test location query (simulating dashboard question button)', async () => {
        const response = await request(app)
          .post('/call')
          .send({
            user_input: 'Where are you located?',
            business_id: testBusinessId
          })
          .expect(200);

        expect(response.body.intent).toBe('location');
        expect(response.body.text_response).toContain('789 Dashboard Ave');
      });

      test('should test halal query (simulating dashboard question button)', async () => {
        const response = await request(app)
          .post('/call')
          .send({
            user_input: 'Do you have halal options?',
            business_id: testBusinessId
          })
          .expect(200);

        expect(response.body.intent).toBe('halal');
        expect(response.body.text_response).toContain('Halal options available');
      });

      test('should test booking query (simulating dashboard question button)', async () => {
        const response = await request(app)
          .post('/call')
          .send({
            user_input: 'Can I make a reservation?',
            business_id: testBusinessId
          })
          .expect(200);

        expect(response.body.intent).toBe('booking');
        expect(response.body.text_response).toContain('reservation');
      });

      test('should provide audio URLs when available', async () => {
        // Set environment for TTS
        const originalProvider = process.env.TTS_PROVIDER;
        process.env.TTS_PROVIDER = 'open_source';

        try {
          const response = await request(app)
            .post('/call')
            .send({
              user_input: 'What are your hours?',
              business_id: testBusinessId
            })
            .expect(200);

          if (response.body.audio_available) {
            expect(response.body.audio_url).toBeDefined();
            expect(response.body.audio_url_relative).toBeDefined();
            expect(response.body.audio).toBeDefined();

            // Test that audio file can be accessed
            const audioPath = response.body.audio_url_relative;
            const audioResponse = await request(app)
              .get(audioPath)
              .expect(200);

            expect(audioResponse.headers['content-type']).toMatch(/audio/);
          }
        } finally {
          process.env.TTS_PROVIDER = originalProvider;
        }
      });
    });

    describe('Custom Question Testing', () => {
      beforeAll(async () => {
        // Ensure test business exists
        await request(app)
          .post(`/api/business/${testBusinessId}`)
          .send(testBusinessData);
      });

      test('should handle custom user questions', async () => {
        const customQuestions = [
          'Tell me about your vegetarian options',
          'What payment methods do you accept?',
          'How much is delivery?',
          'Are you open on weekends?'
        ];

        for (const question of customQuestions) {
          const response = await request(app)
            .post('/call')
            .send({
              user_input: question,
              business_id: testBusinessId
            })
            .expect(200);

          expect(response.body).toHaveProperty('intent');
          expect(response.body).toHaveProperty('text_response');
          expect(response.body.text_response.length).toBeGreaterThan(0);
        }
      });

      test('should handle fallback responses for unrecognized questions', async () => {
        const response = await request(app)
          .post('/call')
          .send({
            user_input: 'Random dashboard test gibberish xyz123',
            business_id: testBusinessId
          })
          .expect(200);

        expect(response.body.intent).toBe('fallback');
        expect(response.body.text_response).toContain('I\'m sorry');
      });
    });

    describe('Error Handling in Dashboard Context', () => {
      test('should handle invalid business ID gracefully', async () => {
        const response = await request(app)
          .post('/call')
          .send({
            user_input: 'What are your hours?',
            business_id: 'non-existent-dashboard-business'
          })
          .expect(404);

        expect(response.body.error).toBe('Business not found');
      });

      test('should handle malformed API requests', async () => {
        const response = await request(app)
          .post('/call')
          .send({
            user_input: 'What are your hours?'
            // Missing business_id
          })
          .expect(400);

        expect(response.body.error).toBe('Invalid request');
      });

      test('should handle empty user input', async () => {
        const response = await request(app)
          .post('/call')
          .send({
            user_input: '',
            business_id: testBusinessId
          })
          .expect(200);

        // Should still provide a valid response
        expect(response.body).toHaveProperty('text_response');
        expect(response.body).toHaveProperty('intent');
      });
    });

    describe('Performance and Scalability', () => {
      test('should handle rapid sequential requests (simulating UI interactions)', async () => {
        const rapidRequests = Array(10).fill().map((_, i) =>
          request(app)
            .post('/call')
            .send({
              user_input: `Test request ${i}`,
              business_id: testBusinessId
            })
        );

        const responses = await Promise.all(rapidRequests);

        responses.forEach(response => {
          expect(response.status).toBe(200);
          expect(response.body).toHaveProperty('text_response');
        });
      });

      test('should maintain performance with large business data', async () => {
        const largeBusiness = {
          ...testBusinessData,
          services: Array(100).fill().map((_, i) => ({
            name: `Service ${i}`,
            description: `Description for service ${i}`,
            price: 10 + i,
            duration: 30 + i
          }))
        };

        const businessId = 'large-business-test';

        // Save large business
        await request(app)
          .post(`/api/business/${businessId}`)
          .send(largeBusiness)
          .expect(200);

        // Test performance with large data
        const startTime = Date.now();
        const response = await request(app)
          .post('/call')
          .send({
            user_input: 'What services do you offer?',
            business_id: businessId
          })
          .expect(200);

        const responseTime = Date.now() - startTime;
        expect(responseTime).toBeLessThan(5000); // Should complete within 5 seconds
        expect(response.body.intent).toBe('menu');

        // Clean up
        const filePath = path.join(__dirname, '..', 'data', `${businessId}.json`);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      });
    });
  });

  describe('Audio File Management for Dashboard', () => {
    test('should serve audio files for dashboard playback', async () => {
      // First generate an audio file
      const originalProvider = process.env.TTS_PROVIDER;
      process.env.TTS_PROVIDER = 'open_source';

      try {
        const callResponse = await request(app)
          .post('/call')
          .send({
            user_input: 'What are your hours?',
            business_id: 'pizzakarachi'
          })
          .expect(200);

        if (callResponse.body.audio_available && callResponse.body.audio_url_relative) {
          const audioResponse = await request(app)
            .get(callResponse.body.audio_url_relative)
            .expect(200);

          expect(audioResponse.headers['content-type']).toMatch(/audio/);
        }
      } finally {
        process.env.TTS_PROVIDER = originalProvider;
      }
    });

    test('should handle audio info endpoint for dashboard monitoring', async () => {
      const response = await request(app)
        .get('/audio/info')
        .expect(200);

      expect(response.body).toHaveProperty('totalFiles');
      expect(response.body).toHaveProperty('totalSize');
      expect(response.body).toHaveProperty('oldestFile');
      expect(response.body).toHaveProperty('newestFile');
    });

    test('should handle audio cleanup endpoint for dashboard management', async () => {
      const response = await request(app)
        .get('/audio/cleanup')
        .expect(200);

      expect(response.body).toHaveProperty('filesRemoved');
      expect(response.body).toHaveProperty('spaceFreed');
    });
  });
});