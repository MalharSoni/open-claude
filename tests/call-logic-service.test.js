const { handleCallLogic, handleCallLogicWithAbsoluteUrls } = require('../services/callLogic');
const fs = require('fs');
const path = require('path');

describe('Call Logic Service Tests', () => {
  const testBusinessId = 'call-logic-test';
  const testBusinessData = {
    name: 'Call Logic Test Business',
    phone: '(555) 999-8888',
    address: '456 Test Avenue, Test City, TC 67890',
    hours: {
      monday: '8am–6pm',
      tuesday: '8am–6pm',
      wednesday: '8am–6pm',
      thursday: '8am–6pm',
      friday: '8am–7pm',
      saturday: '9am–5pm',
      sunday: '10am–3pm'
    },
    services: [
      {
        name: 'Test Service 1',
        description: 'First test service',
        price: 50,
        duration: 30
      }
    ],
    delivery: {
      available: true,
      areas: ['Test Area 1', 'Test Area 2'],
      fee: 5,
      minimum: 20
    },
    payment_methods: ['cash', 'credit'],
    special_notes: {
      halal: 'All food is halal certified'
    }
  };

  beforeAll(() => {
    // Create test business data file
    const dataDir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const filePath = path.join(dataDir, `${testBusinessId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(testBusinessData, null, 2));
  });

  afterAll(() => {
    // Clean up test file
    const filePath = path.join(__dirname, '..', 'data', `${testBusinessId}.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Clean up any generated audio files
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

  describe('handleCallLogic', () => {
    test('should handle hours intent correctly', async () => {
      const result = await handleCallLogic('What are your hours?', testBusinessId);

      expect(result).toHaveProperty('text_response');
      expect(result).toHaveProperty('intent', 'hours');
      expect(result).toHaveProperty('business_id', testBusinessId);
      expect(result).toHaveProperty('audio_available');
      expect(result.text_response).toContain('8am–6pm');
    });

    test('should handle delivery intent correctly', async () => {
      const result = await handleCallLogic('Do you deliver to Test Area 1?', testBusinessId);

      expect(result.intent).toBe('delivery');
      expect(result.text_response).toContain('deliver');
      expect(result.text_response).toContain('Test Area 1');
    });

    test('should handle menu intent correctly', async () => {
      const result = await handleCallLogic('What services do you offer?', testBusinessId);

      expect(result.intent).toBe('menu');
      expect(result.text_response).toContain('Test Service 1');
    });

    test('should handle location intent correctly', async () => {
      const result = await handleCallLogic('Where are you located?', testBusinessId);

      expect(result.intent).toBe('location');
      expect(result.text_response).toContain('456 Test Avenue');
    });

    test('should handle payment intent correctly', async () => {
      const result = await handleCallLogic('What payment methods do you accept?', testBusinessId);

      expect(result.intent).toBe('payment');
      expect(result.text_response).toContain('cash');
      expect(result.text_response).toContain('credit');
    });

    test('should handle halal intent correctly', async () => {
      const result = await handleCallLogic('Is your food halal?', testBusinessId);

      expect(result.intent).toBe('halal');
      expect(result.text_response).toContain('halal certified');
    });

    test('should handle booking intent correctly', async () => {
      const result = await handleCallLogic('Can I make a reservation?', testBusinessId);

      expect(result.intent).toBe('booking');
      expect(result.text_response).toContain('reservation');
    });

    test('should handle generic intent correctly', async () => {
      const result = await handleCallLogic('Hello', testBusinessId);

      expect(result.intent).toBe('generic');
      expect(result.text_response).toContain('Call Logic Test Business');
    });

    test('should handle fallback intent correctly', async () => {
      const result = await handleCallLogic('Random gibberish xyz123', testBusinessId);

      expect(result.intent).toBe('fallback');
      expect(result.text_response).toContain('I\'m sorry');
    });

    test('should include audio information when TTS is available', async () => {
      // Set up environment for open source TTS
      const originalProvider = process.env.TTS_PROVIDER;
      process.env.TTS_PROVIDER = 'open_source';

      try {
        const result = await handleCallLogic('What are your hours?', testBusinessId);

        if (result.audio_available) {
          expect(result).toHaveProperty('audio_url_relative');
          expect(result).toHaveProperty('audio');
          expect(result).toHaveProperty('audio_content_type');
          expect(result).toHaveProperty('audio_provider');
        }
      } finally {
        process.env.TTS_PROVIDER = originalProvider;
      }
    });

    test('should provide backwards compatibility response field', async () => {
      const result = await handleCallLogic('Hello', testBusinessId);

      expect(result).toHaveProperty('response');
      expect(result.response).toBe(result.text_response);
    });
  });

  describe('handleCallLogicWithAbsoluteUrls', () => {
    const mockReq = {
      secure: false,
      get: jest.fn(() => 'localhost:3001')
    };

    test('should generate absolute URLs when request context provided', async () => {
      process.env.TTS_PROVIDER = 'open_source';

      try {
        const result = await handleCallLogicWithAbsoluteUrls('What are your hours?', testBusinessId, mockReq);

        if (result.audio_available) {
          expect(result.audio_url).toMatch(/^http:\/\/localhost:3001\/audio\//);
          expect(result.audio_url_relative).toMatch(/^\/audio\//);
        }
      } finally {
        delete process.env.TTS_PROVIDER;
      }
    });

    test('should handle HTTPS requests correctly', async () => {
      const httpsReq = {
        secure: true,
        get: jest.fn(() => 'example.com')
      };

      process.env.TTS_PROVIDER = 'open_source';

      try {
        const result = await handleCallLogicWithAbsoluteUrls('Hello', testBusinessId, httpsReq);

        if (result.audio_available) {
          expect(result.audio_url).toMatch(/^https:\/\/example\.com\/audio\//);
        }
      } finally {
        delete process.env.TTS_PROVIDER;
      }
    });

    test('should work without request context', async () => {
      const result = await handleCallLogicWithAbsoluteUrls('Hello', testBusinessId);

      expect(result).toHaveProperty('text_response');
      expect(result).toHaveProperty('intent');
      expect(result).toHaveProperty('business_id', testBusinessId);
    });
  });

  describe('Error Handling', () => {
    test('should throw error for non-existent business', async () => {
      await expect(handleCallLogic('Hello', 'non-existent-business'))
        .rejects.toThrow('No data found for business_id: non-existent-business');
    });

    test('should handle malformed business data files', async () => {
      const badBusinessId = 'bad-business-data';
      const badFilePath = path.join(__dirname, '..', 'data', `${badBusinessId}.json`);

      // Create a malformed JSON file
      fs.writeFileSync(badFilePath, '{ invalid json }');

      try {
        await expect(handleCallLogic('Hello', badBusinessId))
          .rejects.toThrow();
      } finally {
        if (fs.existsSync(badFilePath)) {
          fs.unlinkSync(badFilePath);
        }
      }
    });

    test('should handle TTS generation errors gracefully', async () => {
      // Mock TTS service to throw error
      const ttsService = require('../services/tts');
      const originalGenerateAudio = ttsService.generateAudio;

      ttsService.generateAudio = jest.fn().mockRejectedValue(new Error('TTS Error'));

      try {
        const result = await handleCallLogic('Hello', testBusinessId);

        // Should still return a valid response even if TTS fails
        expect(result).toHaveProperty('text_response');
        expect(result).toHaveProperty('audio_available', false);
      } finally {
        ttsService.generateAudio = originalGenerateAudio;
      }
    });
  });

  describe('Performance', () => {
    test('should respond within reasonable time', async () => {
      const startTime = Date.now();
      await handleCallLogic('What are your hours?', testBusinessId);
      const endTime = Date.now();

      const responseTime = endTime - startTime;
      expect(responseTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    test('should handle multiple concurrent requests', async () => {
      const requests = Array(5).fill().map((_, i) =>
        handleCallLogic(`Test request ${i}`, testBusinessId)
      );

      const results = await Promise.all(requests);

      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result).toHaveProperty('text_response');
        expect(result).toHaveProperty('intent');
      });
    });
  });
});