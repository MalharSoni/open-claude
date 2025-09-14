const TTSService = require('../services/tts');
const fs = require('fs');
const path = require('path');

describe('TTS Service Tests', () => {
  const originalEnv = process.env;
  const testBusinessId = 'tts-test-business';

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;

    // Clean up test audio files
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

  describe('Open Source TTS Generation', () => {
    beforeEach(() => {
      process.env.TTS_PROVIDER = 'open_source';
      delete process.env.ELEVENLABS_API_KEY;
      delete process.env.OPENAI_API_KEY;
    });

    test('should generate audio with open source TTS', async () => {
      const text = 'Hello, welcome to our test business!';
      const result = await TTSService.generateAudio(text, testBusinessId);

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('audio');
      expect(result).toHaveProperty('contentType', 'audio/mpeg');
      expect(result).toHaveProperty('provider', 'open_source');
      expect(result).toHaveProperty('url');
      expect(result).toHaveProperty('filepath');
      expect(result.url).toMatch(`/audio/${testBusinessId}`);

      // Check if file was actually created
      expect(fs.existsSync(result.filepath)).toBe(true);
    });

    test('should handle long text input', async () => {
      const longText = 'This is a very long text that might be used to test how the TTS service handles longer inputs. '.repeat(10);
      const result = await TTSService.generateAudio(longText, testBusinessId);

      expect(result.success).toBe(true);
      expect(result.text).toBe(longText);
    });

    test('should handle empty text gracefully', async () => {
      const result = await TTSService.generateAudio('', testBusinessId);

      expect(result.success).toBe(true);
      expect(result.text).toBe('');
    });

    test('should create unique filenames', async () => {
      const text = 'Test unique filename generation';

      const result1 = await TTSService.generateAudio(text, testBusinessId);
      await new Promise(resolve => setTimeout(resolve, 10)); // Small delay
      const result2 = await TTSService.generateAudio(text, testBusinessId);

      expect(result1.url).not.toBe(result2.url);
      expect(result1.filepath).not.toBe(result2.filepath);
    });
  });

  describe('generateSpeech method', () => {
    beforeEach(() => {
      process.env.TTS_PROVIDER = 'open_source';
    });

    test('should work with default options', async () => {
      const text = 'Testing generateSpeech method';
      const result = await TTSService.generateSpeech(text);

      expect(result.success).toBe(true);
      expect(result.provider).toBe('open_source');
    });

    test('should respect custom options', async () => {
      const text = 'Testing with custom options';
      const options = {
        voice: 'custom-voice',
        provider: 'open_source',
        businessId: testBusinessId
      };

      const result = await TTSService.generateSpeech(text, options);

      expect(result.success).toBe(true);
      expect(result.voice).toBe('default'); // open source uses default voice
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      process.env.TTS_PROVIDER = 'open_source';
    });

    test('should handle file system errors', async () => {
      // Mock fs.writeFileSync to throw an error
      const originalWriteFileSync = fs.writeFileSync;
      fs.writeFileSync = jest.fn(() => {
        throw new Error('File system error');
      });

      try {
        const result = await TTSService.generateAudio('Test error handling', testBusinessId);
        expect(result.success).toBe(false);
        expect(result.error).toContain('File system error');
      } finally {
        fs.writeFileSync = originalWriteFileSync;
      }
    });

    test('should handle missing TTS provider configuration', async () => {
      delete process.env.TTS_PROVIDER;
      delete process.env.ELEVENLABS_API_KEY;
      delete process.env.OPENAI_API_KEY;

      const result = await TTSService.generateAudio('Test no provider', testBusinessId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('No TTS provider configured');
    });
  });

  describe('Audio File Management', () => {
    beforeEach(() => {
      process.env.TTS_PROVIDER = 'open_source';
    });

    test('should create audio directory if it does not exist', async () => {
      const audioDir = path.join(__dirname, '..', 'public', 'audio');

      // Temporarily remove directory if it exists
      let dirExisted = false;
      if (fs.existsSync(audioDir)) {
        dirExisted = true;
      }

      const result = await TTSService.generateAudio('Test directory creation', testBusinessId);

      expect(result.success).toBe(true);
      expect(fs.existsSync(audioDir)).toBe(true);
    });

    test('should generate base64 encoded audio', async () => {
      const result = await TTSService.generateAudio('Test base64 encoding', testBusinessId);

      expect(result.success).toBe(true);
      expect(result.audio).toBeDefined();
      expect(typeof result.audio).toBe('string');
      expect(result.audio.length).toBeGreaterThan(0);

      // Check if it's valid base64
      expect(() => {
        Buffer.from(result.audio, 'base64');
      }).not.toThrow();
    });

    test('should set correct content type', async () => {
      const result = await TTSService.generateAudio('Test content type', testBusinessId);

      expect(result.success).toBe(true);
      expect(result.contentType).toBe('audio/mpeg');
    });
  });

  describe('Business ID Integration', () => {
    beforeEach(() => {
      process.env.TTS_PROVIDER = 'open_source';
    });

    test('should include business ID in filename', async () => {
      const customBusinessId = 'my-custom-business-123';
      const result = await TTSService.generateAudio('Test business ID', customBusinessId);

      expect(result.success).toBe(true);
      expect(result.url).toContain(customBusinessId);
      expect(result.filepath).toContain(customBusinessId);
    });

    test('should handle default business ID', async () => {
      const result = await TTSService.generateAudio('Test default business');

      expect(result.success).toBe(true);
      expect(result.url).toContain('default');
    });
  });
});