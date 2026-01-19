import { Request, Response, NextFunction } from 'express';
import { getPrisma } from '../config/prisma_client';
import { z } from 'zod';
import { formatTimestampToLocal } from '../utils/time';
import { asyncHandler } from '../middleware/errorHandler';

const prisma = getPrisma();

// Day constants
const DAYS_ABBREVIATED = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const DAY_NAMES_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Create a new booking for an item
export const createBooking = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id: itemId } = req.params;

    const parsed = z.object({
      startTime: z.string().datetime(),
      endTime: z.string().datetime()
    }).parse(req.body);

    // Convert ISO datetime to Date objects for validation
    let startTime = new Date(parsed.startTime);
    let endTime = new Date(parsed.endTime);

    // Validate time range
    if (startTime >= endTime) {
      return res.status(400).json({ error: 'startTime must be before endTime' });
    }

    // Validate not in the past
    if (startTime < new Date()) {
      return res.status(400).json({ error: 'Cannot book slots in the past' });
    }

    // Convert to local time for storage by creating new Date objects
    // This ensures times are stored in local timezone format (DD-MM-YYYY HH:MM:SS)
    const localStartTime = new Date(startTime.getTime());
    const localEndTime = new Date(endTime.getTime());
    
    // Override startTime and endTime with local versions for storage
    startTime = localStartTime;
    endTime = localEndTime;

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

    // Validate booking must match one of the defined availability slots (full slot booking only)
    const avlTimes = (item.avl_times as any) || [];
    const bookingMatchesSlot = avlTimes.some((timeSlot: any) => {
      // Compare times in UTC format (HH:MM strings)
      // Both the slot times and booking times are in HH:MM format
      const bookingStartStr = formatTimeStringUTC(startTime);
      const bookingEndStr = formatTimeStringUTC(endTime);
      
      // Booking must exactly match the slot
      return bookingStartStr === timeSlot.start && bookingEndStr === timeSlot.end;
    });

    if (!bookingMatchesSlot) {
      return res.status(400).json({ 
        error: 'Booking time must match one of the available time slots exactly',
        availableSlots: avlTimes,
        requestedTime: {
          start: formatTimeStringUTC(startTime),
          end: formatTimeStringUTC(endTime)
        }
      });
    }

    // Validate the booking falls within item's availability day
    const isWithinAvailability = checkAvailability(item, startTime, endTime);
    if (!isWithinAvailability) {
      return res.status(400).json({ 
        error: 'Requested day is outside item availability days',
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
        error: 'This slot is already booked',
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
});



/**
 * Get available time slots for an item on a specific date
 */
export const getAvailableSlots = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
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
    const dayOfWeek = DAYS_ABBREVIATED[dateUTC.getUTCDay()];
    const avlDaysLower = (item.avl_days || []).map(d => d.toLowerCase());
    
    if (!avlDaysLower.includes(dayOfWeek)) {
      const formattedAvailableDays = avlDaysLower.map(d => DAY_NAMES_FULL[DAYS_ABBREVIATED.indexOf(d)] || d);
      const fullDayName = DAY_NAMES_FULL[dateUTC.getUTCDay()];
      return res.json({
        date: dateParam,
        dayOfWeek,
        message: `Item is not available on ${fullDayName}`,
        availableDays: formattedAvailableDays,
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

    // Return only FULL, completely unbooked slots (no partial bookings allowed)
    // If any booking overlaps with a slot, the entire slot becomes unavailable
    const availableSlots: Array<{ startTime: string; endTime: string; available: boolean }> = [];

    for (const timeSlot of avlTimes) {
      // Convert availability window to timestamps
      const slotStart = parseTimeToDateUTC(dateParam, timeSlot.start);
      const slotEnd = parseTimeToDateUTC(dateParam, timeSlot.end);

      // Check if ANY booking overlaps with this slot
      const hasOverlap = bookings.some((booking) => {
        // Booking overlaps if: booking.start < slot.end AND booking.end > slot.start
        return booking.start_time < slotEnd && booking.end_time > slotStart;
      });

      // Only include slot if it has NO overlapping bookings
      if (!hasOverlap) {
        availableSlots.push({
          startTime: formatTimeStringUTC(slotStart),
          endTime: formatTimeStringUTC(slotEnd),
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
});



/**
 * Helper fuctions: Check if the requested time slot falls within item's availability
 * Note: We extract date components in UTC to match the ISO input format
 */
function checkAvailability(item: any, startTime: Date, endTime: Date): boolean {
  // Check day of week in UTC (matching the ISO timestamp format)
  const dayOfWeek = DAYS_ABBREVIATED[startTime.getUTCDay()];
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
