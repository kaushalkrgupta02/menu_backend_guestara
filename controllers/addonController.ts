import { Request, Response } from 'express';
import { getPrisma } from '../config/prisma_client';
import { z } from 'zod';
import { formatTimestampToLocal } from '../utils/time';

const prisma = getPrisma();

/**
 * Create a new addon for an item
 * POST /items/:id/addons
 */
export const createAddon = async (req: Request, res: Response) => {
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
};

/**
 * List all addons for an item
 * GET /items/:id/addons
 */
export const listAddons = async (req: Request, res: Response) => {
  try {
    const { id: itemId } = req.params;
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

    const addons = await prisma.addon.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    const decimal = require('../utils/decimal');

    const formatted = addons.map(addon => ({
      ...addon,
      price: decimal.decimalToNumber(addon.price, 0),
      createdAt: formatTimestampToLocal(addon.createdAt),
      updatedAt: formatTimestampToLocal(addon.updatedAt)
    }));

    res.json({
      itemId,
      itemName: item.name,
      total: formatted.length,
      addons: formatted
    });

  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
