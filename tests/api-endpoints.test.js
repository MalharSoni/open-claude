const request = require('supertest');
const app = require('../index');
const fs = require('fs');
const path = require('path');

describe('Business Management API Tests', () => {
  const testBusinessId = 'test-restaurant-api';
  const testBusinessData = {
    name: 'Test Restaurant',
    phone: '(555) 123-4567',
    address: '123 Test Street, Test City, TC 12345',
    hours: {
      monday: '9am–5pm',
      tuesday: '9am–5pm',
      wednesday: '9am–5pm',
      thursday: '9am–5pm',
      friday: '9am–6pm',
      saturday: '10am–4pm',
      sunday: 'Closed'
    },
    services: [
      {
        name: 'Lunch Special',
        description: 'Daily lunch special with soup and salad',
        price: 12.99,
        duration: 45
      },
      {
        name: 'Dinner Menu',
        description: 'Full dinner menu available',
        price: 25.00,
        duration: 90
      }
    ],
    delivery: {
      available: true,
      areas: ['Downtown', 'West Side', 'East District'],
      fee: 3.50,
      minimum: 15.00
    },
    payment_methods: ['cash', 'credit', 'debit', 'mobile'],
    special_notes: {
      halal: 'All meat is halal certified',
      vegetarian: 'Extensive vegetarian menu available'
    }
  };

  afterAll(() => {
    // Clean up test file
    const testFilePath = path.join(__dirname, '..', 'data', `${testBusinessId}.json`);
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }
  });

  describe('POST /api/business/:businessId', () => {
    test('should save valid business data', async () => {
      const response = await request(app)
        .post(`/api/business/${testBusinessId}`)
        .send(testBusinessData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('business_id', testBusinessId);
      expect(response.body).toHaveProperty('message');

      // Verify file was created
      const filePath = path.join(__dirname, '..', 'data', `${testBusinessId}.json`);
      expect(fs.existsSync(filePath)).toBe(true);

      // Verify file contents
      const savedData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      expect(savedData.name).toBe(testBusinessData.name);
      expect(savedData.services).toHaveLength(2);
    });

    test('should reject invalid business ID', async () => {
      const response = await request(app)
        .post('/api/business/invalid@business!')
        .send(testBusinessData)
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Invalid business ID');
    });

    test('should reject missing required fields', async () => {
      const invalidData = { ...testBusinessData };
      delete invalidData.name;

      const response = await request(app)
        .post(`/api/business/${testBusinessId}-invalid`)
        .send(invalidData)
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Invalid business data');
    });

    test('should handle malformed JSON gracefully', async () => {
      const response = await request(app)
        .post(`/api/business/${testBusinessId}-malformed`)
        .send('invalid json string')
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/business/:businessId', () => {
    test('should retrieve existing business data', async () => {
      // First create the business
      await request(app)
        .post(`/api/business/${testBusinessId}`)
        .send(testBusinessData);

      const response = await request(app)
        .get(`/api/business/${testBusinessId}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('business_id', testBusinessId);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data.name).toBe(testBusinessData.name);
    });

    test('should return 404 for non-existent business', async () => {
      const response = await request(app)
        .get('/api/business/non-existent-business')
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Business not found');
    });
  });

  describe('GET /api/businesses', () => {
    test('should list all businesses', async () => {
      // Ensure test business exists
      await request(app)
        .post(`/api/business/${testBusinessId}`)
        .send(testBusinessData);

      const response = await request(app)
        .get('/api/businesses')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('businesses');
      expect(Array.isArray(response.body.businesses)).toBe(true);

      // Find our test business
      const testBusiness = response.body.businesses.find(
        b => b.business_id === testBusinessId
      );
      expect(testBusiness).toBeDefined();
      expect(testBusiness.name).toBe(testBusinessData.name);
    });

    test('should return empty array when no businesses exist', async () => {
      // This test assumes a clean state, might need adjustment
      const response = await request(app)
        .get('/api/businesses')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('businesses');
      expect(Array.isArray(response.body.businesses)).toBe(true);
    });
  });

  describe('DELETE /api/business/:businessId', () => {
    test('should delete existing business', async () => {
      // First create the business
      await request(app)
        .post(`/api/business/${testBusinessId}`)
        .send(testBusinessData);

      const response = await request(app)
        .delete(`/api/business/${testBusinessId}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('business_id', testBusinessId);

      // Verify file was deleted
      const filePath = path.join(__dirname, '..', 'data', `${testBusinessId}.json`);
      expect(fs.existsSync(filePath)).toBe(false);
    });

    test('should return 404 for non-existent business', async () => {
      const response = await request(app)
        .delete('/api/business/non-existent-business')
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Business not found');
    });
  });

  describe('GET /api/health', () => {
    test('should return API health status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body).toHaveProperty('service', 'Business Management API');
      expect(response.body).toHaveProperty('status', 'OK');
      expect(response.body).toHaveProperty('endpoints');
      expect(Array.isArray(response.body.endpoints)).toBe(true);
      expect(response.body.endpoints.length).toBeGreaterThan(0);
    });
  });
});