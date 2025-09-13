const express = require('express');
const Joi = require('joi');
const bookingService = require('../services/mockBookingService');

const router = express.Router();

const bookingSchema = Joi.object({
  customerName: Joi.string().min(2).max(100).required(),
  customerEmail: Joi.string().email().required(),
  customerPhone: Joi.string().pattern(/^[\+]?[1-9][\d]{0,15}$/).required(),
  date: Joi.string().isoDate().required(),
  startTime: Joi.string().isoDate().required(),
  endTime: Joi.string().isoDate().required(),
  serviceType: Joi.string().valid('consultation', 'appointment', 'meeting', 'other').required(),
  notes: Joi.string().max(500).optional()
});

const availabilitySchema = Joi.object({
  date: Joi.string().isoDate().required(),
  duration: Joi.number().min(15).max(240).default(30)
});

router.get('/availability', async (req, res) => {
  try {
    const { error, value } = availabilitySchema.validate(req.query);
    if (error) {
      return res.status(400).json({
        error: 'Invalid request parameters',
        details: error.details[0].message
      });
    }

    const { date, duration } = value;
    const availableSlots = await bookingService.getAvailableSlots(date, duration);

    res.json({
      date,
      duration,
      availableSlots,
      count: availableSlots.length
    });
  } catch (error) {
    console.error('Error fetching availability:', error);
    res.status(500).json({
      error: 'Failed to fetch availability',
      message: error.message
    });
  }
});

router.post('/', async (req, res) => {
  try {
    const { error, value } = bookingSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Invalid booking data',
        details: error.details[0].message
      });
    }

    const startTime = new Date(value.startTime);
    const endTime = new Date(value.endTime);
    const now = new Date();

    if (startTime <= now) {
      return res.status(400).json({
        error: 'Cannot book appointments in the past'
      });
    }

    if (startTime >= endTime) {
      return res.status(400).json({
        error: 'End time must be after start time'
      });
    }

    const booking = await bookingService.createBooking(value);

    res.status(201).json({
      message: 'Booking created successfully',
      booking
    });
  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({
      error: 'Failed to create booking',
      message: error.message
    });
  }
});

router.delete('/:bookingId', async (req, res) => {
  try {
    const { bookingId } = req.params;

    if (!bookingId) {
      return res.status(400).json({
        error: 'Booking ID is required'
      });
    }

    const result = await bookingService.cancelBooking(bookingId);

    res.json({
      message: 'Booking cancelled successfully',
      result
    });
  } catch (error) {
    console.error('Error cancelling booking:', error);
    res.status(500).json({
      error: 'Failed to cancel booking',
      message: error.message
    });
  }
});

router.get('/health', (req, res) => {
  res.json({
    service: 'Booking Service',
    status: 'OK',
    endpoints: [
      'GET /book/availability?date=YYYY-MM-DD&duration=30',
      'POST /book',
      'DELETE /book/:eventId'
    ]
  });
});

module.exports = router;