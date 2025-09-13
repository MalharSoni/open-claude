class MockBookingService {
  constructor() {
    this.bookings = new Map();
    this.bookingId = 1;
  }

  async getAvailableSlots(date, duration = 30) {
    const slots = [];
    const requestedDate = new Date(date);
    const startHour = 9;
    const endHour = 17;

    for (let hour = startHour; hour < endHour; hour++) {
      for (let minutes = 0; minutes < 60; minutes += duration) {
        const startTime = new Date(requestedDate);
        startTime.setHours(hour, minutes, 0, 0);

        const endTime = new Date(startTime);
        endTime.setMinutes(endTime.getMinutes() + duration);

        if (endTime.getHours() <= endHour) {
          const slotKey = `${date}_${hour}:${minutes}`;

          if (!this.isSlotBooked(slotKey)) {
            slots.push({
              startTime: startTime.toISOString(),
              endTime: endTime.toISOString(),
              duration: duration,
              available: true
            });
          }
        }
      }
    }

    return slots;
  }

  isSlotBooked(slotKey) {
    for (const booking of this.bookings.values()) {
      if (booking.slotKey === slotKey && booking.status === 'confirmed') {
        return true;
      }
    }
    return false;
  }

  async createBooking({ customerName, customerEmail, customerPhone, date, startTime, endTime, serviceType, notes }) {
    const bookingId = `BOOK-${this.bookingId++}-${Date.now()}`;

    const slotKey = this.getSlotKey(startTime);

    if (this.isSlotBooked(slotKey)) {
      throw new Error('This time slot is already booked');
    }

    const booking = {
      bookingId,
      customerName,
      customerEmail,
      customerPhone,
      startTime,
      endTime,
      serviceType,
      notes,
      status: 'confirmed',
      createdAt: new Date().toISOString(),
      slotKey
    };

    this.bookings.set(bookingId, booking);

    return {
      success: true,
      bookingId,
      booking: {
        ...booking,
        confirmationMessage: `Booking confirmed for ${customerName} on ${new Date(startTime).toLocaleString()}`
      }
    };
  }

  async cancelBooking(bookingId) {
    if (!this.bookings.has(bookingId)) {
      throw new Error('Booking not found');
    }

    const booking = this.bookings.get(bookingId);
    booking.status = 'cancelled';
    booking.cancelledAt = new Date().toISOString();

    return {
      success: true,
      message: 'Booking cancelled successfully',
      bookingId
    };
  }

  async getBooking(bookingId) {
    if (!this.bookings.has(bookingId)) {
      throw new Error('Booking not found');
    }

    return this.bookings.get(bookingId);
  }

  async getAllBookings() {
    return Array.from(this.bookings.values());
  }

  getSlotKey(startTime) {
    const date = new Date(startTime);
    const dateStr = date.toISOString().split('T')[0];
    const hour = date.getHours();
    const minutes = date.getMinutes();
    return `${dateStr}_${hour}:${minutes}`;
  }
}

module.exports = new MockBookingService();