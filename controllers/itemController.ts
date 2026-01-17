import { Request, Response } from 'express';
import { getPrisma } from '../config/prisma_client';
import { z } from 'zod';
import { resolveItemPrice } from '../services/price_engine';
import { formatTimestampToLocal } from '../utils/time';
import {PricingTypeKey} from '../services/price_engine';



const prisma = getPrisma();

export const createItem = async (req: Request, res: Response) => {
  try {
    const body = req.body;
    // Basic validation
    const parsed = z.object({
      name: z.string(),
      description: z.string().optional(),
      image: z.string().optional(),
      categoryId: z.string().optional(),
      subcategoryId: z.string().optional(),
      base_price: z.number().optional(),
      //this item belongs to which pricing type
      type_of_pricing: z.string().optional(),
      tax_applicable: z.boolean().optional(),
      tax_percentage: z.number().optional(),
      // availability fields validate & normalize below
      avl_days: z.array(z.string()).optional(),
      avl_times: z.array(z.any()).optional(),
      is_active: z.boolean().optional()
    }).parse(body);



    // trim and coerce inputs first
    const categoryIdRaw = parsed.categoryId ? parsed.categoryId.trim() : undefined;
    const subcategoryIdRaw = parsed.subcategoryId ? parsed.subcategoryId.trim() : undefined;

    const data: any = {
      name: parsed.name,
      description: parsed.description,
      image: parsed.image,
      base_price: parsed.base_price,
      type_of_pricing: parsed.type_of_pricing as PricingTypeKey | undefined,
      tax_applicable: parsed.tax_applicable,
      tax_percentage: parsed.tax_percentage,
      // avl fields normalized below (undefined if absent)
      is_active: parsed.is_active
    };     

    // An item may belong to either a category OR a subcategory, but not both (use trimmed/coerced values)
    if (categoryIdRaw && subcategoryIdRaw) {
      throw new Error('An item may belong to either a category or a subcategory, not both');
    }

    // name unique under same parent hence check categoryId and subcategoryId and then item name uniqueness
    const existingItem = await prisma.item.findFirst({
      where: {
        name: parsed.name,
        categoryId: categoryIdRaw || null,
        subcategoryId: subcategoryIdRaw || null
      }
    });

    if (existingItem) {
      throw new Error('An item with the same name already exists under the specified category or subcategory');
    }

    // Normalize availability fields: validate and coerce invalid inputs to undefined (omit from create)
    const validDays = ['mon','tue','wed','thu','fri','sat','sun'];

    let avlDays: string[] | undefined = undefined;
    if (Array.isArray(parsed.avl_days) && parsed.avl_days.length) {
      const cleaned = parsed.avl_days
        .filter(Boolean)
        .map((d: string) => (typeof d === 'string' ? d.trim().toLowerCase() : ''))
        .filter((d: string) => validDays.includes(d));
      avlDays = cleaned.length ? cleaned : undefined;
    }

    const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
    let avlTimes: { start: string; end: string }[] | undefined = undefined;
    if (Array.isArray(parsed.avl_times) && parsed.avl_times.length) {
      const cleaned: { start: string; end: string }[] = [];
      for (const t of parsed.avl_times) {
        if (!t || typeof t.start !== 'string' || typeof t.end !== 'string') continue;
        const start = t.start.trim();
        const end = t.end.trim();
        if (!timeRegex.test(start) || !timeRegex.test(end)) continue;
        if (start >= end) continue;
        cleaned.push({ start, end });
      }
      avlTimes = cleaned.length ? cleaned : undefined;
    }

    if (typeof avlDays !== 'undefined') data.avl_days = avlDays;
    if (typeof avlTimes !== 'undefined') data.avl_times = avlTimes;

    // check the tax_applicable and tax_percentage logic from the category or subcategory provided and then inherit if not provided
    if (categoryIdRaw) {
      const category = await prisma.category.findUnique({ where: { id: categoryIdRaw } });
      if (!category) throw new Error('Category not found');

      // Prepare connect for creation
      data.category = { connect: { id: categoryIdRaw } };

      // If only tax_percentage is provided, infer tax_applicable from it
      if (data.tax_applicable === undefined && data.tax_percentage !== undefined) {
        data.tax_applicable = data.tax_percentage > 0;
      }

      if (data.tax_applicable === true) {
        // If item explicitly wants tax but hasn't provided a positive percentage, try to inherit from category
        if (data.tax_percentage === undefined || data.tax_percentage <= 0) {
          if (category.tax_applicable && category.tax_percentage && category.tax_percentage > 0) {
            data.tax_percentage = category.tax_percentage;
          } else {
            throw new Error('tax_percentage must be greater than 0 when tax_applicable is true');
          }
        }
        // If tax_percentage > 0 is provided, accept it (item-level override)
      } else if (data.tax_applicable === false) {
        // Inconsistent: tax_applicable false but tax_percentage > 0
        if (data.tax_percentage && data.tax_percentage > 0) {
          throw new Error('If tax_applicable is false, tax_percentage must be 0');
        }
        data.tax_percentage = 0;
      } else {
        // Neither tax fields provided -> inherit from category
        data.tax_applicable = category.tax_applicable;
        data.tax_percentage = category.tax_percentage;
      }
    } else if (subcategoryIdRaw) {
      const subcategory = await prisma.subcategory.findUnique({ where: { id: subcategoryIdRaw } });
      if (!subcategory) throw new Error('Subcategory not found');

      // Prepare connect for creation
      data.subcategory = { connect: { id: subcategoryIdRaw } };

      // If only tax_percentage is provided, infer tax_applicable from it
      if (data.tax_applicable === undefined && data.tax_percentage !== undefined) {
        data.tax_applicable = data.tax_percentage > 0;
      }

      if (data.tax_applicable === true) {
        // If item explicitly wants tax but hasn't provided a positive percentage, try to inherit from subcategory
        if (data.tax_percentage === undefined || data.tax_percentage <= 0) {
          if (subcategory.tax_applicable && subcategory.tax_percentage && subcategory.tax_percentage > 0) {
            data.tax_percentage = subcategory.tax_percentage;
          } else {
            throw new Error('tax_percentage must be greater than 0 when tax_applicable is true');
          }
        }
      } else if (data.tax_applicable === false) {
        if (data.tax_percentage && data.tax_percentage > 0) {
          throw new Error('If tax_applicable is false, tax_percentage must be 0');
        }
        data.tax_percentage = 0;
      } else {
        data.tax_applicable = subcategory.tax_applicable;
        data.tax_percentage = subcategory.tax_percentage;
      }
    }
       
    //final creation
    const item = await prisma.item.create({ data });

    res.status(201).json({
      ...item,
      createdAt: formatTimestampToLocal(item.createdAt),
      updatedAt: formatTimestampToLocal(item.updatedAt)
    });
  } catch (err) {
    try {
      if (err && (err as any).issues) {
        const zErr = err as any;
        console.error('Validation error:', JSON.stringify(zErr.issues));
        return res.status(400).json({ error: 'Validation failed', details: zErr.issues });
      }

      // Defensive logging for unexpected errors (avoid util.inspect crashes)
      const message = err && (err as any).message ? (err as any).message : String(err);
      console.error('Error in createItem:', message);
      if (err && (err as any).stack) console.error((err as any).stack);
      res.status(500).json({ error: message });
    } catch (logErr) {
      console.error('Error while handling error:', String(logErr));
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};

export const listItems = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, parseInt(req.query.limit as string) || 10);
    const sortBy = (req.query.sortBy as string) || 'createdAt';
    const sortDir = ((req.query.sortDir as string) || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';
    const qSearch = (req.query.q as string) || undefined;
    const categoryId = req.query.categoryId as string | undefined;
    const activeOnly = req.query.activeOnly !== 'false';

    const where: any = {};
    if (qSearch) where.name = { contains: qSearch, mode: 'insensitive' };
    if (categoryId) where.categoryId = categoryId;
    if (activeOnly) where.is_active = true;

    const [total, items] = await prisma.$transaction([
      prisma.item.count({ where }),
      prisma.item.findMany({
        where,
        orderBy: { [sortBy === 'price' ? 'createdAt' : sortBy]: sortDir },
        skip: (page - 1) * limit,
        take: limit
      })
    ]);

    const itemsWithPrice = items.map((it) => {
      const price = resolveItemPrice(it as any, {} as any);
      return { 
        ...it, 
        resolvedPrice: price,
        createdAt: formatTimestampToLocal(it.createdAt),
        updatedAt: formatTimestampToLocal(it.updatedAt)
      };
    });

    res.json({ page, limit, total, items: itemsWithPrice });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: (err as Error).message });
  }
};

export const getItem = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const item = await prisma.item.findUnique({
      where: { id },
      include: {
        category: true,
        subcategory: true
      }
    });

    if (!item) return res.status(404).json({ error: 'Item not found' });

    let is_active = !!item.is_active;
    if (item.category && !item.category.is_active) is_active = false;
    if (item.subcategory && !item.subcategory.is_active) is_active = false;

    res.json({
      ...item,
      is_active,
      createdAt: formatTimestampToLocal(item.createdAt),
      updatedAt: formatTimestampToLocal(item.updatedAt),
      category: item.category ? {
        ...item.category,
        createdAt: formatTimestampToLocal(item.category.createdAt),
        updatedAt: formatTimestampToLocal(item.category.updatedAt)
      } : null,
      subcategory: item.subcategory ? {
        ...item.subcategory,
        createdAt: formatTimestampToLocal(item.subcategory.createdAt),
        updatedAt: formatTimestampToLocal(item.subcategory.updatedAt)
      } : null
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: (err as Error).message });
  }
};

export const getItemPrice = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const usageHours = req.query.usageHours ? parseFloat(req.query.usageHours as string) : undefined;
    const currentTime = req.query.currentTime as string | undefined;

    const item = await prisma.item.findUnique({
      where: { id },
      include: {
        category: true,
        subcategory: true
      }
    });

    if (!item) return res.status(404).json({ error: 'Item not found' });

    const price = resolveItemPrice(item as any, { usageHours, currentTime });

    res.json({
    //   pricingType: price.pricingType,
      basePrice: price.basePrice,
      discount: price.discount,
      taxPercentage: price.taxPercentage,
      taxAmount: price.taxAmount,
      grandTotal: price.grandTotal,
      isAvailable: price.isAvailable
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: (err as Error).message });
  }
};
