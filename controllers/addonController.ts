import { Request, Response, NextFunction } from 'express';
import { getPrisma } from '../config/prisma_client';
import { z } from 'zod';
import { formatTimestampToLocal } from '../utils/time';
import { asyncHandler } from '../middleware/errorHandler';

const prisma = getPrisma();

/**
 * Create a new addon for an item
 * POST /items/:id/addons
 */
export const createAddon = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id: itemId } = req.params;

    const parsed = z.object({
      name: z.string().trim().min(1, "Name is required"),
      price: z.number().nonnegative().refine((n) => Number.isFinite(n) && Math.round(n * 100) === Math.round(n * 100), { 
        message: 'price must have at most 2 decimal places' 
      }),
      isMandatory: z.boolean().optional().default(false),
      isActive: z.boolean().optional().default(true)
    }).parse(req.body);

    // Verify item exists
    const item = await prisma.item.findUnique({ where: { id: itemId } });
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Create addon
    const addon = await prisma.addon.create({
      data: {
        itemId,
        name: parsed.name,
        price: parsed.price,
        is_mandatory: parsed.isMandatory,
        is_active: parsed.isActive
      }
    });

    const decimal = require('../utils/decimal');

    res.status(201).json({
      ...addon,
      price: decimal.decimalToNumber(addon.price, 0),
      createdAt: formatTimestampToLocal(addon.createdAt),
      updatedAt: formatTimestampToLocal(addon.updatedAt)
    });

  } catch (err: any) {
    const message = err instanceof z.ZodError ? err.issues : err.message;
    res.status(400).json({ error: message });
  }
});

/**
 * List all addons for an item
 * GET /items/:id/addons
 */
export const listAddons = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id: itemId } = req.params;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, parseInt(req.query.limit as string) || 10);
    const sortBy = (req.query.sortBy as string) || 'createdAt';
    const sortDir = ((req.query.sortDir as string) || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';
    const minPrice = req.query.minPrice ? parseFloat(req.query.minPrice as string) : undefined;
    const maxPrice = req.query.maxPrice ? parseFloat(req.query.maxPrice as string) : undefined;
    const activeOnly = req.query.activeOnly !== 'false';

    // Verify item exists
    const item = await prisma.item.findUnique({ where: { id: itemId } });
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const where: any = { itemId };
    if (activeOnly) {
      where.is_active = true;
    }

    // Price range filtering
    if (minPrice !== undefined || maxPrice !== undefined) {
      where.price = {};
      if (minPrice !== undefined) where.price.gte = minPrice;
      if (maxPrice !== undefined) where.price.lte = maxPrice;
    }

    const [total, addons] = await prisma.$transaction([
      prisma.addon.count({ where }),
      prisma.addon.findMany({
        where,
        orderBy: { [sortBy === 'price' ? 'price' : sortBy]: sortDir },
        skip: (page - 1) * limit,
        take: limit
      })
    ]);

    const decimal = require('../utils/decimal');

    const formatted = addons.map(addon => ({
      ...addon,
      price: decimal.decimalToNumber(addon.price, 0),
      createdAt: formatTimestampToLocal(addon.createdAt),
      updatedAt: formatTimestampToLocal(addon.updatedAt)
    }));

    res.json({
      page,
      limit,
      total,
      itemId,
      itemName: item.name,
      addons: formatted
    });

  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});
