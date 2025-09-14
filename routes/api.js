const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const Joi = require('joi');

// Schema for business data validation
const businessSchema = Joi.object({
  name: Joi.string().required(),
  phone: Joi.string().optional(),
  address: Joi.string().optional(),
  hours: Joi.object().pattern(
    Joi.string(),
    Joi.string()
  ).optional(),
  services: Joi.array().items(
    Joi.object({
      name: Joi.string().required(),
      description: Joi.string().optional(),
      price: Joi.number().optional(),
      duration: Joi.number().optional()
    })
  ).optional(),
  delivery: Joi.object({
    available: Joi.boolean().optional(),
    areas: Joi.array().items(Joi.string()).optional(),
    fee: Joi.number().optional(),
    minimum: Joi.number().optional()
  }).optional(),
  payment_methods: Joi.array().items(Joi.string()).optional(),
  special_notes: Joi.object().optional()
});

/**
 * Save business data
 * POST /api/business/:businessId
 */
router.post('/business/:businessId', async (req, res) => {
  try {
    const { businessId } = req.params;

    // Validate business ID format
    if (!/^[a-zA-Z0-9-_]+$/.test(businessId)) {
      return res.status(400).json({
        error: 'Invalid business ID',
        message: 'Business ID can only contain letters, numbers, hyphens, and underscores'
      });
    }

    // Validate business data
    const { error, value } = businessSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Invalid business data',
        details: error.details[0].message
      });
    }

    // Ensure data directory exists
    const dataDir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Save business data to file
    const filePath = path.join(dataDir, `${businessId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(value, null, 2));

    console.log(`[API] Business data saved for: ${businessId}`);

    res.json({
      success: true,
      message: `Business data saved for ${businessId}`,
      business_id: businessId,
      file_path: filePath
    });

  } catch (error) {
    console.error('[API] Error saving business data:', error);
    res.status(500).json({
      error: 'Failed to save business data',
      message: error.message
    });
  }
});

/**
 * Get business data
 * GET /api/business/:businessId
 */
router.get('/business/:businessId', async (req, res) => {
  try {
    const { businessId } = req.params;
    const filePath = path.join(__dirname, '..', 'data', `${businessId}.json`);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        error: 'Business not found',
        message: `No data found for business_id: ${businessId}`
      });
    }

    const businessData = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    res.json({
      success: true,
      business_id: businessId,
      data: businessData
    });

  } catch (error) {
    console.error('[API] Error loading business data:', error);
    res.status(500).json({
      error: 'Failed to load business data',
      message: error.message
    });
  }
});

/**
 * List all businesses
 * GET /api/businesses
 */
router.get('/businesses', async (req, res) => {
  try {
    const dataDir = path.join(__dirname, '..', 'data');

    if (!fs.existsSync(dataDir)) {
      return res.json({
        success: true,
        businesses: []
      });
    }

    const files = fs.readdirSync(dataDir)
      .filter(file => file.endsWith('.json'))
      .map(file => {
        const businessId = file.replace('.json', '');
        const filePath = path.join(dataDir, file);

        try {
          const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          return {
            business_id: businessId,
            name: data.name || businessId,
            created: fs.statSync(filePath).birthtime,
            modified: fs.statSync(filePath).mtime
          };
        } catch (error) {
          console.error(`Error reading business file ${file}:`, error);
          return null;
        }
      })
      .filter(business => business !== null)
      .sort((a, b) => b.modified - a.modified);

    res.json({
      success: true,
      businesses: files
    });

  } catch (error) {
    console.error('[API] Error listing businesses:', error);
    res.status(500).json({
      error: 'Failed to list businesses',
      message: error.message
    });
  }
});

/**
 * Delete business data
 * DELETE /api/business/:businessId
 */
router.delete('/business/:businessId', async (req, res) => {
  try {
    const { businessId } = req.params;
    const filePath = path.join(__dirname, '..', 'data', `${businessId}.json`);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        error: 'Business not found',
        message: `No data found for business_id: ${businessId}`
      });
    }

    fs.unlinkSync(filePath);

    console.log(`[API] Business data deleted for: ${businessId}`);

    res.json({
      success: true,
      message: `Business data deleted for ${businessId}`,
      business_id: businessId
    });

  } catch (error) {
    console.error('[API] Error deleting business data:', error);
    res.status(500).json({
      error: 'Failed to delete business data',
      message: error.message
    });
  }
});

/**
 * Health check for API
 */
router.get('/health', (req, res) => {
  res.json({
    service: 'Business Management API',
    status: 'OK',
    timestamp: new Date().toISOString(),
    endpoints: [
      'POST /api/business/:businessId - Save business data',
      'GET /api/business/:businessId - Get business data',
      'GET /api/businesses - List all businesses',
      'DELETE /api/business/:businessId - Delete business data'
    ]
  });
});

module.exports = router;