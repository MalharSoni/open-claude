const request = require('supertest');
const app = require('../index');
const fs = require('fs');
const path = require('path');

describe('/call endpoint tests', () => {

  test('should detect hours intent and return proper response', async () => {
    const response = await request(app)
      .post('/call')
      .send({
        user_input: 'Are you open on Sundays?',
        business_id: 'pizzakarachi'
      })
      .expect(200);

    expect(response.body).toHaveProperty('text_response');
    expect(response.body).toHaveProperty('intent', 'hours');
    expect(response.body).toHaveProperty('business_id', 'pizzakarachi');
    expect(response.body).toHaveProperty('audio_available');
    expect(response.body.text_response).toContain('Sunday');
  });

  test('should detect delivery intent', async () => {
    const response = await request(app)
      .post('/call')
      .send({
        user_input: 'Do you deliver to North York?',
        business_id: 'pizzakarachi'
      })
      .expect(200);

    expect(response.body.intent).toBe('delivery');
    expect(response.body.text_response).toContain('deliver');
    expect(response.body.text_response).toContain('North York');
  });

  test('should detect menu intent for vegetarian options', async () => {
    const response = await request(app)
      .post('/call')
      .send({
        user_input: 'Do you have vegetarian options?',
        business_id: 'pizzakarachi'
      })
      .expect(200);

    expect(response.body.intent).toBe('menu');
    expect(response.body.text_response).toContain('vegetarian');
  });

  test('should detect halal intent', async () => {
    const response = await request(app)
      .post('/call')
      .send({
        user_input: 'Is your meat halal?',
        business_id: 'pizzakarachi'
      })
      .expect(200);

    expect(response.body.intent).toBe('halal');
    expect(response.body.text_response).toContain('halal');
  });

  test('should fallback for unrecognized input', async () => {
    const response = await request(app)
      .post('/call')
      .send({
        user_input: 'Random gibberish xyz123',
        business_id: 'pizzakarachi'
      })
      .expect(200);

    expect(response.body.intent).toBe('fallback');
    expect(response.body.text_response).toContain('I\'m sorry');
  });

  test('should return 404 for non-existent business_id', async () => {
    const response = await request(app)
      .post('/call')
      .send({
        user_input: 'What are your hours?',
        business_id: 'nonexistent'
      })
      .expect(404);

    expect(response.body).toHaveProperty('error', 'Business not found');
  });

  test('should return 400 for missing required fields', async () => {
    const response = await request(app)
      .post('/call')
      .send({
        user_input: 'What are your hours?'
        // missing business_id
      })
      .expect(400);

    expect(response.body).toHaveProperty('error', 'Invalid request');
  });

  test('should handle audio generation when TTS is available', async () => {
    const response = await request(app)
      .post('/call')
      .send({
        user_input: 'What are your hours?',
        business_id: 'pizzakarachi'
      })
      .expect(200);

    if (response.body.audio_available) {
      expect(response.body).toHaveProperty('audio_url');
      expect(response.body.audio_url).toMatch(/\/audio\/pizzakarachi-\d+(-opensource)?\.mp3$/);

      // Check if audio file actually exists
      const audioPath = path.join(__dirname, '..', 'public', response.body.audio_url_relative);
      expect(fs.existsSync(audioPath)).toBe(true);
    }
  });

  test('should validate business data loading', async () => {
    const response = await request(app)
      .post('/call')
      .send({
        user_input: 'Where are you located?',
        business_id: 'pizzakarachi'
      })
      .expect(200);

    expect(response.body.intent).toBe('location');
    expect(response.body.text_response).toContain('123 Main St, Toronto');
  });

  // Test multiple intents for comprehensive coverage
  const testCases = [
    { input: 'Can I make a reservation?', expectedIntent: 'booking' },
    { input: 'What payment methods do you accept?', expectedIntent: 'payment' },
    { input: 'Hello there!', expectedIntent: 'generic' }
  ];

  testCases.forEach(({ input, expectedIntent }) => {
    test(`should detect ${expectedIntent} intent for: "${input}"`, async () => {
      const response = await request(app)
        .post('/call')
        .send({
          user_input: input,
          business_id: 'pizzakarachi'
        })
        .expect(200);

      expect(response.body.intent).toBe(expectedIntent);
    });
  });

});

describe('Audio file cleanup', () => {
  test('should not accumulate too many audio files', () => {
    const audioDir = path.join(__dirname, '..', 'public', 'audio');
    if (fs.existsSync(audioDir)) {
      const files = fs.readdirSync(audioDir);
      // Warn if more than 50 files (adjust threshold as needed)
      if (files.length > 50) {
        console.warn(`Audio directory has ${files.length} files. Consider cleanup.`);
      }
    }
  });
});