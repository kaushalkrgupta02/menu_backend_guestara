import { Request, Response } from 'express';
import { getPrisma } from '../config/prisma_client';
import { z } from 'zod';
import { formatTimestampToLocal } from '../utils/time';

const prisma = getPrisma();

// Create a new booking for an item
export const createBooking = async (req: Request, res: Response) => {
  try {
    const { id: itemId } = req.params;

    const parsed = z.object({
      startTime: z.string().datetime(),
      endTime: z.string().datetime()
    }).parse(req.body);

    const startTime = new Date(parsed.startTime);
    const endTime = new Date(parsed.endTime);

    // Validate time range
    if (startTime >= endTime) {
      return res.status(400).json({ error: 'startTime must be before endTime' });
    }

    // Validate not in the past
    if (startTime < new Date()) {
      return res.status(400).json({ error: 'Cannot book slots in the past' });
    }

    // Find the item and check if it's bookable
    const item = await prisma.item.findUnique({
      where: { id: itemId },
      include: { category: true, subcategory: true }
    });

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    if (!item.is_bookable) {
      return res.status(400).json({ error: 'This item is not bookable' });
    }

    if (!item.is_active) {
      return res.status(400).json({ error: 'This item is not active' });
    }

    // Check if item's parent is active
    const isItemEffectivelyActive = require('../utils/visibility').isItemEffectivelyActive;
    if (!isItemEffectivelyActive(item)) {
      return res.status(400).json({ error: 'This item or its parent is not active' });
    }

    // Validate the booking falls within item's availability
    const isWithinAvailability = checkAvailability(item, startTime, endTime);
    if (!isWithinAvailability) {
      return res.status(400).json({ 
        error: 'Requested time slot is outside item availability windows',
        availability: {
          days: item.avl_days,
          times: item.avl_times
        }
      });
    }

    // Check for existing overlapping bookings
    const overlappingBookings = await prisma.booking.findFirst({
      where: {
        itemId,
        status: { not: 'cancelled' },
        OR: [
          // New booking starts during an existing booking
          {
            AND: [
              { start_time: { lte: startTime } },
              { end_time: { gt: startTime } }
            ]
          },
          // New booking ends during an existing booking
          {
            AND: [
              { start_time: { lt: endTime } },
              { end_time: { gte: endTime } }
            ]
          },
          // New booking completely contains an existing booking
          {
            AND: [
              { start_time: { gte: startTime } },
              { end_time: { lte: endTime } }
            ]
          }
        ]
      }
    });

    if (overlappingBookings) {
      return res.status(409).json({ 
        error: 'Time slot is already booked',
        conflict: {
          start: formatTimestampToLocal(overlappingBookings.start_time),
          end: formatTimestampToLocal(overlappingBookings.end_time)
        }
      });
    }

    // Create the booking
    const booking = await prisma.booking.create({
      data: {
        itemId,
        start_time: startTime,
        end_time: endTime,
        status: 'confirmed'
      },
      include: {
        item: {
          select: {
            id: true,
            name: true,
            description: true,
            image: true
          }
        }
      }
    });

    res.status(201).json({
      ...booking,
      start_time: formatTimestampToLocal(booking.start_time),
      end_time: formatTimestampToLocal(booking.end_time),
      createdAt: formatTimestampToLocal(booking.createdAt),
      updatedAt: formatTimestampToLocal(booking.updatedAt)
    });

  } catch (err: any) {
    const message = err instanceof z.ZodError ? err.issues : err.message;
    res.status(400).json({ error: message });
  }
};



/**
 * Get available time slots for an item on a specific date
 */
export const getAvailableSlots = async (req: Request, res: Response) => {
  try {
    const { id: itemId } = req.params;
    const dateParam = req.query.date as string;

    if (!dateParam) {
      return res.status(400).json({ error: 'date query parameter is required (format: YYYY-MM-DD)' });
    }

    // Parse the date
    const requestedDate = new Date(dateParam);
    if (isNaN(requestedDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
    }

    // Set to start of day in local timezone
    requestedDate.setHours(0, 0, 0, 0);

    // Check if the requested date is in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (requestedDate < today) {
      return res.status(400).json({ error: "Availability can't be checked for past dates" });
    }

    // Find the item
    const item = await prisma.item.findUnique({
      where: { id: itemId },
      include: { category: true, subcategory: true }
    });

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    if (!item.is_bookable) {
      return res.status(400).json({ error: 'This item is not bookable' });
    }

    // Check if item's parent is active
    const isItemEffectivelyActive = require('../utils/visibility').isItemEffectivelyActive;
    if (!isItemEffectivelyActive(item)) {
      return res.status(400).json({ error: 'This item or its parent is not active' });
    }

    // Check if the requested day is in the item's available days
    // Parse date as UTC to avoid timezone issues
    const dateUTC = new Date(dateParam + 'T00:00:00.000Z');
    const dayOfWeek = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][dateUTC.getUTCDay()];
    const avlDaysLower = (item.avl_days || []).map(d => d.toLowerCase());
    
    if (!avlDaysLower.includes(dayOfWeek)) {
      return res.json({
        date: dateParam,
        dayOfWeek,
        message: `Item is not available on ${dayOfWeek}`,
        availableDays: item.avl_days,
        slots: []
      });
    }

    // Get time slots from item's avl_times
    const avlTimes = (item.avl_times as any) || [];
    if (!Array.isArray(avlTimes) || avlTimes.length === 0) {
      return res.json({
        date: dateParam,
        message: 'No time slots defined for this item',
        slots: []
      });
    }

    // Get all bookings for this item on the requested date (UTC boundaries)
    const startOfDay = new Date(dateParam + 'T00:00:00.000Z');
    const endOfDay = new Date(dateParam + 'T23:59:59.999Z');

    const bookings = await prisma.booking.findMany({
      where: {
        itemId,
        status: { not: 'cancelled' },
        start_time: { gte: startOfDay },
        end_time: { lte: endOfDay }
      },
      orderBy: { start_time: 'asc' }
    });

    // Calculate remaining available slots by subtracting bookings from availability windows
    const availableSlots: Array<{ startTime: string; endTime: string; available: boolean }> = [];

    for (const timeSlot of avlTimes) {
      // Convert availability window to timestamps
      const avlStart = parseTimeToDateUTC(dateParam, timeSlot.start);
      const avlEnd = parseTimeToDateUTC(dateParam, timeSlot.end);

      // Start with the full availability window
      const freeSlots: Array<{ start: Date; end: Date }> = [{ start: avlStart, end: avlEnd }];

      // Subtract each booking from the free slots
      for (const booking of bookings) {
        const bookingStart = booking.start_time;
        const bookingEnd = booking.end_time;

        // Process each free slot and split if booking overlaps
        for (let i = freeSlots.length - 1; i >= 0; i--) {
          const slot = freeSlots[i];

          // Check if booking overlaps with this free slot
          if (bookingStart < slot.end && bookingEnd > slot.start) {
            // Remove the overlapped slot
            freeSlots.splice(i, 1);

            // Add back the non-overlapping parts
            if (slot.start < bookingStart) {
              // Part before the booking
              freeSlots.push({ start: slot.start, end: bookingStart });
            }
            if (slot.end > bookingEnd) {
              // Part after the booking
              freeSlots.push({ start: bookingEnd, end: slot.end });
            }
          }
        }
      }

      // Convert free slots back to time strings and add to result
      for (const slot of freeSlots) {
        availableSlots.push({
          startTime: formatTimeStringUTC(slot.start),
          endTime: formatTimeStringUTC(slot.end),
          available: true
        });
      }
    }

    // Sort slots by start time
    availableSlots.sort((a, b) => a.startTime.localeCompare(b.startTime));

    res.json({
      date: dateParam,
      dayOfWeek,
      itemId,
      itemName: item.name,
      slots: availableSlots
    });

  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};



/**
 * Helper fuctions: Check if the requested time slot falls within item's availability
 * Note: We extract date components in UTC to match the ISO input format
 */
function checkAvailability(item: any, startTime: Date, endTime: Date): boolean {
  // Check day of week in UTC (matching the ISO timestamp format)
  const dayOfWeek = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][startTime.getUTCDay()];
  const avlDaysLower = (item.avl_days || []).map((d: string) => d.toLowerCase());
  
  if (!avlDaysLower.includes(dayOfWeek)) {
    return false;
  }

  // Check time range
  const avlTimes = (item.avl_times as any) || [];
  if (!Array.isArray(avlTimes) || avlTimes.length === 0) {
    return false;
  }

  const startTimeStr = formatTimeStringUTC(startTime);
  const endTimeStr = formatTimeStringUTC(endTime);

  // Check if the booking falls within any of the available time slots
  return avlTimes.some((timeSlot: any) => {
    return startTimeStr >= timeSlot.start && endTimeStr <= timeSlot.end;
  });
}

/**
 * Helper: Format Date to HH:MM string in UTC timezone
 */
function formatTimeStringUTC(date: Date): string {
  const hours = date.getUTCHours().toString().padStart(2, '0');
  const minutes = date.getUTCMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Helper: Format Date to HH:MM string in local timezone
 */
function formatTimeString(date: Date): string {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Helper: Parse time string (HH:MM) and combine with date in UTC
 */
function parseTimeToDateUTC(dateStr: string, timeStr: string): Date {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return new Date(`${dateStr}T${timeStr}:00.000Z`);
}

/**
 * Helper: Parse time string (HH:MM) and combine with date (local timezone)
 */
function parseTimeToDate(date: Date, timeStr: string): Date {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const result = new Date(date);
  result.setHours(hours, minutes, 0, 0);
  return result;
}
