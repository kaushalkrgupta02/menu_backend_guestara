import { Request, Response } from 'express';
import { getPrisma } from '../config/prisma_client';
import { z } from 'zod';
import { resolveItemPrice } from '../services/price_engine';
import { formatTimestampToLocal } from '../utils/time';
import {PricingTypeKey} from '../services/price_engine';
import { isItemEffectivelyActive } from '../utils/visibility';


const prisma = getPrisma();

export const createItem = async (req: Request, res: Response) => {
  try {
    const parsed = z.object({
      name: z.string().trim().min(1, "Name is required"),
      description: z.string().optional(),
      image: z.string().url().optional().or(z.literal("")),
      categoryId: z.string().optional(),
      subcategoryId: z.string().optional(),
      base_price: z.number().nonnegative().default(0),
      type_of_pricing: z.string().optional(),
      price_config: z.any().optional(),
      is_tax_inherit: z.boolean().optional(),
      tax_applicable: z.boolean().optional(),
      tax_percentage: z.number().optional(),
      avl_days: z.array(z.string()).optional(),
      avl_times: z.array(z.object({ 
        start: z.string(), 
        end: z.string() 
      })).optional(),
      is_active: z.boolean().optional().default(true)
    }).parse(req.body);

    const catId = parsed.categoryId?.trim();
    const subId = parsed.subcategoryId?.trim();

    if (catId && subId) {
      throw new Error('An item may belong to either a category or a subcategory, not both');
    }

    const hasTaxPayload = parsed.tax_percentage !== undefined || parsed.tax_applicable !== undefined;

    // Explicit check requested: If user says "Inherit", they cannot send "Tax Data"
    if (parsed.is_tax_inherit === true && hasTaxPayload) {
      return res.status(400).json({ 
        error: "Invalid request: Cannot accept tax payloads when is_tax_inherit is true." 
      });
    }

    // Default to true if no tax info is provided, otherwise respect user or auto-set to false
    const isInheriting = parsed.is_tax_inherit ?? !hasTaxPayload;

    const data: any = {
      name: parsed.name,
      description: parsed.description,
      image: parsed.image,
      base_price: parsed.base_price,
      type_of_pricing: parsed.type_of_pricing,
      price_config: parsed.price_config,
      is_active: parsed.is_active,
      is_tax_inherit: isInheriting,
      // If inheriting, keep it clean with NULL. If not, map the values.
      tax_applicable: isInheriting ? null : (parsed.tax_applicable ?? (parsed.tax_percentage! > 0)),
      tax_percentage: isInheriting ? null : (parsed.tax_percentage ?? 0),
    };

    if (!isInheriting) {
      if (data.tax_applicable && data.tax_percentage <= 0) {
        throw new Error('tax_percentage must be > 0 when tax_applicable is true');
      }
      if (!data.tax_applicable && data.tax_percentage > 0) {
        throw new Error('tax_percentage must be 0 when tax_applicable is false');
      }
    }

    // Parent Record Verification
    if (catId) {
      const exists = await prisma.category.findUnique({ where: { id: catId } });
      if (!exists) throw new Error('Category not found');
      data.category = { connect: { id: catId } };
    } else if (subId) {
      const exists = await prisma.subcategory.findUnique({ where: { id: subId } });
      if (!exists) throw new Error('Subcategory not found');
      data.subcategory = { connect: { id: subId } };
    }

    // Name Uniqueness Check
    const duplicate = await prisma.item.findFirst({
      where: { name: data.name, categoryId: catId || null, subcategoryId: subId || null }
    });
    if (duplicate) throw new Error('An item with this name already exists under this parent');

    // Availability Normalization
    if (parsed.avl_days) {
      const valid = ['mon','tue','wed','thu','fri','sat','sun'];
      data.avl_days = parsed.avl_days.map(d => d.toLowerCase()).filter(d => valid.includes(d));
    }
    if (parsed.avl_times) {
      const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
      data.avl_times = parsed.avl_times.filter(t => 
        timeRegex.test(t.start) && timeRegex.test(t.end) && t.start < t.end
      );
    }

    const item = await prisma.item.create({ data });

    res.status(201).json({
      ...item,
      createdAt: formatTimestampToLocal(item.createdAt),
      updatedAt: formatTimestampToLocal(item.updatedAt)
    });

  } catch (err: any) {
    const message = err instanceof z.ZodError ? err.issues : err.message;
    res.status(400).json({ error: message });
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
        include: { category: true, subcategory: true },
        orderBy: { [sortBy === 'price' ? 'createdAt' : sortBy]: sortDir },
        skip: (page - 1) * limit,
        take: limit
      })
    ]);

    const itemsWithPrice = items.map((it) => {
      const price = resolveItemPrice(it as any, {} as any);
      return { 
        ...it, 
        is_active: isItemEffectivelyActive(it as any),
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

    const effectiveActive = isItemEffectivelyActive(item as any);

    res.json({
      ...item,
      is_active: effectiveActive,
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

    const effectiveActive = isItemEffectivelyActive(item as any);
    const finalIsAvailable = !!price.isAvailable && effectiveActive;

    res.json({
    //   pricingType: price.pricingType,
      basePrice: price.basePrice,
      discount: price.discount,
      taxPercentage: price.taxPercentage,
      taxAmount: price.taxAmount,
      grandTotal: price.grandTotal,
      isAvailable: finalIsAvailable,
      is_active: effectiveActive
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: (err as Error).message });
  }
};

export const patchItem = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const parsed = z.object({
      name: z.string().trim().optional(),
      description: z.string().optional(),
      image: z.string().url().optional().or(z.literal('')).optional(),
      categoryId: z.string().optional(),
      subcategoryId: z.string().optional(),
      base_price: z.number().nonnegative().optional(),
      type_of_pricing: z.string().optional(),
      price_config: z.any().optional(),
      is_tax_inherit: z.boolean().optional(),
      tax_applicable: z.boolean().optional(),
      tax_percentage: z.number().optional(),
      avl_days: z.array(z.string()).optional(),
      avl_times: z.array(z.object({ start: z.string(), end: z.string() })).optional(),
      is_active: z.boolean().optional()
    }).parse(req.body);

    const existing = await prisma.item.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Item not found' });

    // Parent exclusivity
    const catId = parsed.categoryId?.trim();
    const subId = parsed.subcategoryId?.trim();
    if (catId && subId) return res.status(400).json({ error: 'Item may belong to either a category or subcategory, not both' });

    // Parent existence checks if changing
    if (catId && catId !== existing.categoryId) {
      const cat = await prisma.category.findUnique({ where: { id: catId } });
      if (!cat) return res.status(404).json({ error: 'Category not found' });
    }
    if (subId && subId !== existing.subcategoryId) {
      const sub = await prisma.subcategory.findUnique({ where: { id: subId } });
      if (!sub) return res.status(404).json({ error: 'Subcategory not found' });
    }

    // Name uniqueness check within target parent
    const targetCategoryId = parsed.categoryId ?? existing.categoryId;
    const targetSubcategoryId = parsed.subcategoryId ?? existing.subcategoryId;
    if (parsed.name && parsed.name !== existing.name) {
      const dup = await prisma.item.findFirst({ where: {
        name: parsed.name,
        categoryId: targetCategoryId ?? null,
        subcategoryId: targetSubcategoryId ?? null,
        NOT: { id }
      }});
      if (dup) return res.status(400).json({ error: 'An item with this name already exists under this parent' });
    }

    // Tax inheritance logic
    const prevIsInherit = !!existing.is_tax_inherit;
    const newIsInherit = parsed.is_tax_inherit !== undefined ? parsed.is_tax_inherit : prevIsInherit;
    const hasTaxPayload = parsed.tax_percentage !== undefined || parsed.tax_applicable !== undefined;

    if (newIsInherit === true && hasTaxPayload) {
      return res.status(400).json({ error: 'Invalid request: Cannot accept tax payloads when is_tax_inherit is true.' });
    }

    if (newIsInherit === false) {
      const resultingTaxApp = parsed.tax_applicable !== undefined ? parsed.tax_applicable : existing.tax_applicable;
      const resultingTaxPct = parsed.tax_percentage !== undefined ? parsed.tax_percentage : existing.tax_percentage;
      if (resultingTaxApp === null || resultingTaxApp === undefined || resultingTaxPct === null) {
        return res.status(400).json({ error: 'Explicit tax payload required when disabling inheritance' });
      }
      if (resultingTaxApp === true && (resultingTaxPct === null || resultingTaxPct === undefined || resultingTaxPct <= 0)) {
        return res.status(400).json({ error: 'If tax_applicable is true, tax_percentage must be > 0' });
      }
      if (resultingTaxApp === false && resultingTaxPct && resultingTaxPct > 0) {
        return res.status(400).json({ error: 'If tax_applicable is false, tax_percentage must be 0' });
      }
    }

    // Build update payload
    const data: any = { ...parsed };

    // Normalize availability if provided
    if (parsed.avl_days) {
      const valid = ['mon','tue','wed','thu','fri','sat','sun'];
      data.avl_days = parsed.avl_days.map((d: string) => d.toLowerCase()).filter((d: string) => valid.includes(d));
    }
    if (parsed.avl_times) {
      const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
      data.avl_times = parsed.avl_times.filter((t: any) => timeRegex.test(t.start) && timeRegex.test(t.end) && t.start < t.end);
    }

    // Handle tax fields based on inheritance
    if (newIsInherit) {
      data.is_tax_inherit = true;
      data.tax_applicable = null as any;
      data.tax_percentage = null as any;
    } else {
      data.is_tax_inherit = false;
      if (parsed.tax_applicable !== undefined) data.tax_applicable = parsed.tax_applicable;
      if (parsed.tax_percentage !== undefined) data.tax_percentage = parsed.tax_percentage;
    }

    // Parent connect/disconnect
    if (catId !== undefined) {
      data.categoryId = catId ?? null;
      if (catId) {
        data.category = { connect: { id: catId } };
        data.subcategory = { disconnect: true } as any;
      } else {
        data.category = { disconnect: true } as any;
      }
    }
    if (subId !== undefined) {
      data.subcategoryId = subId ?? null;
      if (subId) {
        data.subcategory = { connect: { id: subId } };
        data.category = { disconnect: true } as any;
      } else {
        data.subcategory = { disconnect: true } as any;
      }
    }

    const updated = await prisma.item.update({ where: { id }, data });

    res.json({
      ...updated,
      createdAt: formatTimestampToLocal(updated.createdAt),
      updatedAt: formatTimestampToLocal(updated.updatedAt)
    });

  } catch (err: any) {
    const message = err instanceof z.ZodError ? err.issues : err.message;
    res.status(400).json({ error: message });
  }
};
