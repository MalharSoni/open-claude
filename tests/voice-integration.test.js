const request = require('supertest');
const app = require('../index');

describe('Twilio Voice Integration Tests', () => {

  describe('POST /voice - Initial Call', () => {
    test('should handle first call without speech input', async () => {
      const twilioPayload = {
        From: '+15551234567',
        To: '+15559876543',
        CallSid: 'CAtest123456789'
      };

      const response = await request(app)
        .post('/voice')
        .send(twilioPayload)
        .expect(200);

      expect(response.headers['content-type']).toMatch(/xml/);
      expect(response.text).toContain('<Gather');
      expect(response.text).toContain('input="speech"');
      expect(response.text).toContain('Hello! Welcome to Pizza Karachi');
    });

    test('should return proper TwiML structure', async () => {
      const twilioPayload = {
        From: '+15551234567',
        To: '+15559876543',
      };

      const response = await request(app)
        .post('/voice')
        .send(twilioPayload)
        .expect(200);

      // Check for proper TwiML tags
      expect(response.text).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(response.text).toContain('<Response>');
      expect(response.text).toContain('</Response>');
      expect(response.text).toContain('<Gather>');
      expect(response.text).toContain('</Gather>');
    });
  });

  describe('POST /voice - With Speech Input', () => {
    test('should process hours query and return TwiML', async () => {
      const twilioPayload = {
        From: '+15551234567',
        To: '+15559876543',
        SpeechResult: 'What are your hours?',
        CallSid: 'CAtest123456789'
      };

      const response = await request(app)
        .post('/voice')
        .send(twilioPayload)
        .expect(200);

      expect(response.text).toContain('<Response>');

      // Should either contain <Play> for audio or <Say> for fallback
      const hasPlay = response.text.includes('<Play>');
      const hasSay = response.text.includes('<Say>');
      expect(hasPlay || hasSay).toBe(true);

      if (hasSay) {
        expect(response.text).toContain('open');
      }
    });

    test('should handle delivery query', async () => {
      const twilioPayload = {
        From: '+15551234567',
        To: '+15559876543',
        SpeechResult: 'Do you deliver to North York?',
        CallSid: 'CAtest123456789'
      };

      const response = await request(app)
        .post('/voice')
        .send(twilioPayload)
        .expect(200);

      expect(response.text).toContain('<Response>');

      // Should include either audio playback or text response
      const hasSay = response.text.includes('<Say>');
      const hasPlay = response.text.includes('<Play>');
      expect(hasSay || hasPlay).toBe(true);
    });

    test('should handle menu/vegetarian query', async () => {
      const twilioPayload = {
        From: '+15551234567',
        To: '+15559876543',
        SpeechResult: 'Do you have vegetarian options?',
        CallSid: 'CAtest123456789'
      };

      const response = await request(app)
        .post('/voice')
        .send(twilioPayload)
        .expect(200);

      expect(response.text).toContain('<Response>');

      const hasSay = response.text.includes('<Say>');
      const hasPlay = response.text.includes('<Play>');
      expect(hasSay || hasPlay).toBe(true);
    });

    test('should handle booking requests', async () => {
      const twilioPayload = {
        From: '+15551234567',
        To: '+15559876543',
        SpeechResult: 'Can I make a reservation?',
        CallSid: 'CAtest123456789'
      };

      const response = await request(app)
        .post('/voice')
        .send(twilioPayload)
        .expect(200);

      expect(response.text).toContain('<Response>');

      const hasSay = response.text.includes('<Say>');
      const hasPlay = response.text.includes('<Play>');
      expect(hasSay || hasPlay).toBe(true);
    });

    test('should continue conversation flow', async () => {
      const twilioPayload = {
        From: '+15551234567',
        To: '+15559876543',
        SpeechResult: 'What are your hours?',
        CallSid: 'CAtest123456789'
      };

      const response = await request(app)
        .post('/voice')
        .send(twilioPayload)
        .expect(200);

      // Should include continuation gather and hangup
      expect(response.text).toContain('Is there anything else');
      expect(response.text).toContain('<Hangup/>');
    });

    test('should handle transcription text input', async () => {
      const twilioPayload = {
        From: '+15551234567',
        To: '+15559876543',
        TranscriptionText: 'Where are you located?',
        CallSid: 'CAtest123456789'
      };

      const response = await request(app)
        .post('/voice')
        .send(twilioPayload)
        .expect(200);

      expect(response.text).toContain('<Response>');

      const hasSay = response.text.includes('<Say>');
      const hasPlay = response.text.includes('<Play>');
      expect(hasSay || hasPlay).toBe(true);
    });
  });

  describe('POST /voice - Error Handling', () => {
    test('should handle empty speech gracefully', async () => {
      const twilioPayload = {
        From: '+15551234567',
        To: '+15559876543',
        SpeechResult: '',
        CallSid: 'CAtest123456789'
      };

      const response = await request(app)
        .post('/voice')
        .send(twilioPayload)
        .expect(200);

      expect(response.text).toContain('<Gather>');
      expect(response.text).toContain('Hello! Welcome to Pizza Karachi');
    });

    test('should handle system errors gracefully', async () => {
      const twilioPayload = {
        From: '+15551234567',
        To: '+15559876543',
        SpeechResult: 'Test with non-existent business',
        CallSid: 'CAtest123456789'
      };

      // This might trigger an error internally, but should still return valid TwiML
      const response = await request(app)
        .post('/voice')
        .send(twilioPayload)
        .expect(200);

      expect(response.text).toContain('<Response>');
    });
  });

  describe('GET /voice/health', () => {
    test('should return voice service health status', async () => {
      const response = await request(app)
        .get('/voice/health')
        .expect(200);

      expect(response.body).toHaveProperty('service', 'Twilio Voice Webhook');
      expect(response.body).toHaveProperty('status', 'OK');
      expect(response.body).toHaveProperty('endpoints');
      expect(Array.isArray(response.body.endpoints)).toBe(true);
    });
  });
});