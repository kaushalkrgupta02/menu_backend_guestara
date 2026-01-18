import { Request, Response } from 'express';
import { getPrisma } from '../config/prisma_client';
import { z } from 'zod';
import { resolveItemPrice } from '../services/price_engine';
import { isItemEffectivelyActive } from '../utils/visibility';
import {
  createItemSchema,
  updateItemSchema,
  listItemsQuerySchema,
  filterItemsQuerySchema,
  CreateItemDTO,
  UpdateItemDTO,
  ListItemsQueryDTO,
  FilterItemsQueryDTO
} from '../validations/item.validation';
import { handleValidationError } from '../validations/common.validation';
import { formatItem, formatPaginatedResponse } from '../dto/formatters';


const prisma = getPrisma();

// Legacy helper functions (deprecated - use formatters.ts instead)
const formatTimestampToLocal = (date: Date) => {
  return new Date(date).toLocaleString('en-GB', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
};

export const createItem = async (req: Request, res: Response) => {
  try {
    const parsed = createItemSchema.parse(req.body);

    const catId = parsed.categoryId?.trim();
    const subId = parsed.subcategoryId?.trim();

    const data: any = {
      name: parsed.name,
      description: parsed.description,
      image: parsed.image,
      base_price: parsed.base_price,
      type_of_pricing: parsed.type_of_pricing,
      // price_config will be validated and normalized below if provided
      is_bookable: parsed.is_bookable,
      is_active: parsed.is_active,
      is_tax_inherit: parsed.is_tax_inherit,
      // If inheriting, keep it clean with NULL. If not, map the values.
      tax_applicable: parsed.is_tax_inherit ? null : parsed.tax_applicable,
      tax_percentage: parsed.is_tax_inherit ? null : (parsed.tax_percentage ?? 0),
    };

    if (parsed.is_tax_inherit){
      if (!catId && !subId) {
        return res.status(400).json({ error: "category or sub-category missing how tax inherit then?" });
      }
    }


    if (!parsed.is_tax_inherit) {
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

    // Validate and normalize price_config if provided and/or when a pricing type is set.
    // If type 'A' (STATIC), do not set any price_config and rely on base_price as the amount.
    // If type 'C' (COMPLIMENTARY), base_price must not be provided and stored base_price will be set to 0.
    if (parsed.type_of_pricing) {
      const typeKey = parsed.type_of_pricing as any;
      if (typeKey === 'A') {
        // Static pricing: clear any provided config and use base_price as authoritative
        data.type_of_pricing = typeKey;
        data.price_config = null;
      } else if (typeKey === 'C') {
        // Complimentary: cannot accept a base_price
        if (parsed.base_price !== undefined && parsed.base_price > 0) {
          throw new Error('base_price cannot be provided for COMPLIMENTARY pricing (type C)');
        }
        data.type_of_pricing = typeKey;
        data.price_config = require('../services/price_config').normalizePriceConfig(typeKey, {}, parsed.base_price);
        data.base_price = 0;
      } else if (typeKey === 'D') {
        // Discounted: strict requirement - caller must provide base_price in request (no default allowed)
        if (!Object.prototype.hasOwnProperty.call(req.body, 'base_price')) {
          throw new Error('base_price is required for DISCOUNTED pricing (type D)');
        }
        if ((parsed.base_price ?? 0) <= 0) {
          throw new Error('base_price must be > 0 for DISCOUNTED pricing (type D)');
        }
        try {
          const norm = require('../services/price_config').normalizePriceConfig(typeKey, parsed.price_config, parsed.base_price);
          data.type_of_pricing = typeKey;
          data.price_config = norm;
        } catch (e: any) {
          throw new Error(`Invalid price_config: ${e.message}`);
        }
      } else {
        try {
          const norm = require('../services/price_config').normalizePriceConfig(typeKey, parsed.price_config, parsed.base_price);
          data.type_of_pricing = typeKey;
          data.price_config = norm;
        } catch (e: any) {
          throw new Error(`Invalid price_config: ${e.message}`);
        }
      }
    } else if (parsed.price_config) {
      // price_config with no type is ambiguous
      throw new Error('price_config provided but type_of_pricing is missing');
    }

    // Name Uniqueness Check
    const duplicate = await prisma.item.findFirst({
      where: { name: data.name, categoryId: catId || null, subcategoryId: subId || null }
    });
    if (duplicate) throw new Error('An item with this name already exists under this parent');

    // Availability Normalization
    if (parsed.avl_days) {
      const valid = ['mon','tue','wed','thu','fri','sat','sun'];
      data.avl_days = parsed.avl_days.map((d: string) => d.toLowerCase()).filter((d: string) => valid.includes(d));
    }
    if (parsed.avl_times) {
      const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
      data.avl_times = parsed.avl_times.filter((t: any) => 
        timeRegex.test(t.start) && timeRegex.test(t.end) && t.start < t.end
      );
    }
    // console.log(data.avl_times);
    // console.log(data.avl_days);
    // console.log(parsed.avl_times);
    // console.log(parsed.avl_days);



    // If pricing is DYNAMIC (type 'E'), require avl_times to be provided and ensure windows intersect availability times
    if (data.type_of_pricing === 'E') {
      if (!data.avl_times || data.avl_times.length === 0) {
        throw new Error("DYNAMIC pricing (type E) requires avl_times to be provided and non-empty");
      }

      if (!data.price_config || !data.price_config.config || !Array.isArray(data.price_config.config.windows) || data.price_config.config.windows.length === 0) {
        throw new Error('DYNAMIC pricing requires a non-empty "windows" array in price_config');
      }

      const windows = data.price_config.config.windows as Array<{start:string,end:string,price:number}>;
      const toMinutes = (s: string) => { const [hh, mm] = s.split(':').map(n => parseInt(n,10)); return hh*60 + mm; };
      // Ensure every dynamic window is fully contained within at least one availability window
      const allContained = windows.every((w) => {
        const wStart = toMinutes(w.start); const wEnd = toMinutes(w.end);
        return data.avl_times.some((a: any) => {
          const aStart = toMinutes(a.start); const aEnd = toMinutes(a.end);
          return wStart >= aStart && wEnd <= aEnd;
        });
      });
      if (!allContained) throw new Error("Each DYNAMIC pricing window must be contained within one of the item's avl_times");
    }

    const item = await prisma.item.create({ data });

    res.status(201).json({
      ...item,
      createdAt: formatTimestampToLocal(item.createdAt),
      updatedAt: formatTimestampToLocal(item.updatedAt)
    });

  } catch (err: any) {
    res.status(400).json(handleValidationError(err));
  }
};

export const listItems = async (req: Request, res: Response) => {
  try {
    const query = listItemsQuerySchema.parse(req.query);
    const { page, limit, sortBy, sortDir, q, categoryId, minPrice, maxPrice, taxApplicable, activeOnly } = query;

    const where: any = {};
    if (q) where.name = { contains: q, mode: 'insensitive' };
    if (categoryId) where.categoryId = categoryId;
    if (activeOnly) where.is_active = true;

    // Price range filtering
    if (minPrice !== undefined || maxPrice !== undefined) {
      where.base_price = {};
      if (minPrice !== undefined) where.base_price.gte = minPrice;
      if (maxPrice !== undefined) where.base_price.lte = maxPrice;
    }

    // Tax applicable filtering with inheritance support
    if (taxApplicable !== undefined) {
      if (taxApplicable) {
        where.OR = [
          { AND: [{ is_tax_inherit: true }, { OR: [{ category: { tax_applicable: true } }, { subcategory: { tax_applicable: true } }] }] },
          { AND: [{ is_tax_inherit: false }, { tax_applicable: true }] }
        ];
      } else {
        where.AND = [
          { OR: [{ is_tax_inherit: false }, { category: { tax_applicable: false } }, { subcategory: { tax_applicable: false } }] },
          { tax_applicable: { not: true } }
        ];
      }
    }

    const [total, items] = await prisma.$transaction([
      prisma.item.count({ where }),
      prisma.item.findMany({
        where,
        include: { category: true, subcategory: true },
        orderBy: { [sortBy === 'price' ? 'base_price' : sortBy]: sortDir },
        skip: (page - 1) * limit,
        take: limit
      })
    ]);

    const formattedItems = items.map(formatItem);
    res.json(formatPaginatedResponse(formattedItems, page, limit, total, item => item));
  } catch (err) {
    res.status(400).json(handleValidationError(err));
  }
};

export const filterItems = async (req: Request, res: Response) => {
  try {
    const query = filterItemsQuerySchema.parse(req.query);
    const { page, limit, sortBy, sortDir, minPrice, maxPrice, categoryActive, subcategoryActive, taxApplicable } = query;

    const where: any = {};
    if (categoryActive !== undefined) where.category = { is_active: categoryActive };
    if (subcategoryActive !== undefined) where.subcategory = { is_active: subcategoryActive };

    // Price range filtering
    if (minPrice !== undefined || maxPrice !== undefined) {
      where.base_price = {};
      if (minPrice !== undefined) where.base_price.gte = minPrice;
      if (maxPrice !== undefined) where.base_price.lte = maxPrice;
    }

    // Tax applicable filtering with inheritance support
    if (taxApplicable !== undefined) {
      if (taxApplicable) {
        where.OR = [
          { AND: [{ is_tax_inherit: true }, { OR: [{ category: { tax_applicable: true } }, { subcategory: { tax_applicable: true } }] }] },
          { AND: [{ is_tax_inherit: false }, { tax_applicable: true }] }
        ];
      } else {
        where.AND = [
          { OR: [{ is_tax_inherit: false }, { category: { tax_applicable: false } }, { subcategory: { tax_applicable: false } }] },
          { tax_applicable: { not: true } }
        ];
      }
    }

    const [total, items] = await prisma.$transaction([
      prisma.item.count({ where }),
      prisma.item.findMany({
        where,
        include: { category: true, subcategory: true },
        orderBy: { [sortBy === 'price' ? 'base_price' : sortBy]: sortDir },
        skip: (page - 1) * limit,
        take: limit
      })
    ]);

    const formattedItems = items.map(formatItem);
    res.json(formatPaginatedResponse(formattedItems, page, limit, total, item => item));
  } catch (err) {
    res.status(400).json(handleValidationError(err));
  }
};

export const getItemsByParent = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, parseInt(req.query.limit as string) || 10);
    const sortBy = (req.query.sortBy as string) || 'createdAt';
    const sortDir = ((req.query.sortDir as string) || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';
    const minPrice = req.query.minPrice ? parseFloat(req.query.minPrice as string) : undefined;
    const maxPrice = req.query.maxPrice ? parseFloat(req.query.maxPrice as string) : undefined;
    const taxApplicable = req.query.taxApplicable as string | undefined;

    const categoryId = req.query.categoryId as string | undefined;
    const subcategoryId = req.query.subcategoryId as string | undefined;
    const parentActiveRaw = (req.query.is_active as string | undefined) ?? (req.query.parentActive as string | undefined);
    const parentActive = parentActiveRaw === 'true' ? true : parentActiveRaw === 'false' ? false : undefined;

    // Validate inputs: require exactly one of categoryId or subcategoryId
    if ((!categoryId && !subcategoryId) || (categoryId && subcategoryId)) {
      return res.status(400).json({ error: 'Provide exactly one of categoryId or subcategoryId' });
    }

    const where: any = {};
    if (categoryId) {
      where.categoryId = categoryId;
      if (parentActive !== undefined) where.category = { is_active: parentActive };
    }
    if (subcategoryId) {
      where.subcategoryId = subcategoryId;
      if (parentActive !== undefined) where.subcategory = { is_active: parentActive };
    }

    // Price range filtering
    if (minPrice !== undefined || maxPrice !== undefined) {
      where.base_price = {};
      if (minPrice !== undefined) where.base_price.gte = minPrice;
      if (maxPrice !== undefined) where.base_price.lte = maxPrice;
    }

    // Tax applicable filtering with inheritance support (Option B)
    if (taxApplicable !== undefined) {
      const isTaxApplicable = taxApplicable === 'true';
      if (isTaxApplicable) {
        where.OR = [
          { AND: [{ is_tax_inherit: true }, { OR: [{ category: { tax_applicable: true } }, { subcategory: { tax_applicable: true } }] }] },
          { AND: [{ is_tax_inherit: false }, { tax_applicable: true }] }
        ];
      } else {
        where.AND = [
          { OR: [{ is_tax_inherit: false }, { category: { tax_applicable: false } }, { subcategory: { tax_applicable: false } }] },
          { tax_applicable: { not: true } }
        ];
      }
    }

    const [total, items] = await prisma.$transaction([
      prisma.item.count({ where }),
      prisma.item.findMany({
        where,
        include: { category: true, subcategory: true },
        orderBy: { [sortBy === 'price' ? 'base_price' : sortBy]: sortDir },
        skip: (page - 1) * limit,
        take: limit
      })
    ]);

    const formattedItems = items.map(formatItem);
    res.json(formatPaginatedResponse(formattedItems, page, limit, total, item => item));
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

    res.json(formatItem(item));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: (err as Error).message });
  }
};

export const getItemPrice = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const currentTime = req.query.currentTime as string | undefined;
    const addonIdsParam = req.query.addonIds as string | undefined;

    // Parse addon IDs from comma-separated string or JSON array
    let addonIds: string[] = [];
    if (addonIdsParam) {
      try {
        // Try parsing as JSON array first
        addonIds = JSON.parse(addonIdsParam);
      } catch {
        // Fall back to comma-separated string
        // Split by comma, trim each ID, and filter out empty strings and whitespace
        addonIds = addonIdsParam
          .split(',')
          .map(id => id.trim())
          .filter(id => id.length > 0);
      }
    }

    const item = await prisma.item.findUnique({
      where: { id },
      include: {
        category: true,
        subcategory: true,
        addons: {
          where: { is_active: true }
        }
      }
    });

    if (!item) return res.status(404).json({ error: 'Item not found' });

    // Check for mandatory addons
    const mandatoryAddons = item.addons.filter(addon => addon.is_mandatory);
    const missingMandatory = mandatoryAddons.filter(addon => !addonIds.includes(addon.id));
    
    if (missingMandatory.length > 0) {
      return res.status(400).json({ 
        error: 'Missing mandatory addons',
        mandatoryAddons: missingMandatory.map(a => ({ id: a.id, name: a.name }))
      });
    }

    // Validate provided addon IDs belong to this item
    const validAddonIds = item.addons.map(a => a.id);
    const invalidAddons = addonIds.filter(id => !validAddonIds.includes(id));
    
    if (invalidAddons.length > 0) {
      return res.status(400).json({ 
        error: 'Invalid addon IDs provided',
        invalidIds: invalidAddons,
        availableAddons: item.addons.map(a => ({ id: a.id, name: a.name }))
      });
    }

    let usageHours: number | undefined = undefined;

    // For bookable items with tiered pricing (type B), calculate usage from booking start to now
    if (item.is_bookable && item.type_of_pricing === 'B') {
      const now = currentTime ? new Date(currentTime) : new Date();
      
      // Find booking that started at or before current time
      const activeBooking = await prisma.booking.findFirst({
        where: {
          itemId: id,
          status: { in: ['confirmed', 'completed'] },
          start_time: { lte: now }
        },
        orderBy: { start_time: 'desc' }
      });

      if (activeBooking) {
        // Calculate hours from booking start to current time (ignore end_time)
        const durationMs = now.getTime() - activeBooking.start_time.getTime();
        usageHours = durationMs / (1000 * 60 * 60); // Convert milliseconds to hours
      }
    }

    const price = resolveItemPrice(item as any, { usageHours, currentTime });
    const decimal = require('../utils/decimal');

    // Calculate addon prices
    const selectedAddons = item.addons.filter(addon => addonIds.includes(addon.id));
    const addonsTotal = selectedAddons.reduce((sum, addon) => 
      sum + decimal.decimalToNumber(addon.price, 0), 0
    );
    const addonsNames = selectedAddons.map(addon => addon.name);

    // Calculate final pricing
    // Step 1: Base price with discount
    const baseAfterDiscount = price.basePrice - price.discount;
    
    // Step 2: Calculate tax on base price only (addons are not taxed)
    const taxAmount = (baseAfterDiscount * price.taxPercentage) / 100;
    
    // Step 3: Add addons to final total (after tax)
    const grandTotal = baseAfterDiscount + taxAmount + addonsTotal;

    res.json({
      appliedPricingRule: price.appliedPricingRule,
      basePrice: price.basePrice,
      addonsTotal,
      addonsName: addonsNames,
      discount: price.discount,
      taxPercentage: price.taxPercentage,
      taxAmount,
      grandTotal
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
      base_price: z.number().nonnegative().optional().refine((n) => n === undefined || (Number.isFinite(n) && Math.round(n * 100) === Math.round(n * 100)), { message: 'base_price must have at most 2 decimal places' }),
      type_of_pricing: z.string().optional(),
      price_config: z.any().optional(),
      is_tax_inherit: z.boolean().optional(),
      tax_applicable: z.boolean().optional(),
      tax_percentage: z.number().optional().refine((n) => n === undefined || (Number.isFinite(n) && Math.round(n * 100) === Math.round(n * 100)), { message: 'tax_percentage must have at most 2 decimal places' }),
      avl_days: z.array(z.string()).optional(),
      avl_times: z.array(z.object({ start: z.string(), end: z.string() })).optional(),
      is_bookable: z.boolean().optional(),
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

    // If the item will inherit tax settings, ensure it has (or will have) a parent to inherit from
    if (newIsInherit === true) {
      const finalCategoryId = (catId && catId.length > 0) ? catId : existing.categoryId;
      const finalSubcategoryId = (subId && subId.length > 0) ? subId : existing.subcategoryId;
      if (!finalCategoryId && !finalSubcategoryId) {
        return res.status(400).json({ error: 'category or sub-category missing how tax inherit then?' });
      }
    }

    if (newIsInherit === true && hasTaxPayload) {
      return res.status(400).json({ error: 'Invalid request: Cannot accept tax payloads when is_tax_inherit is true.' });
    }

    if (newIsInherit === false) {
      const decimal = require('../utils/decimal');
      const resultingTaxApp = parsed.tax_applicable !== undefined ? parsed.tax_applicable : existing.tax_applicable;
      const resultingTaxPct = parsed.tax_percentage !== undefined ? parsed.tax_percentage : decimal.decimalToNumber(existing.tax_percentage, 0);
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

    // Determine the effective pricing type after this patch
    const targetType = parsed.type_of_pricing ?? existing.type_of_pricing;
    // If final type is COMPLIMENTARY (C), reject attempts to set a non-zero base_price
    if (targetType === 'C' && parsed.base_price !== undefined && parsed.base_price > 0) {
      return res.status(400).json({ error: 'base_price cannot be provided for COMPLIMENTARY pricing (type C)' });
    }

    // If final type is DISCOUNTED (D), ensure a base_price exists (either being set now or already present)
    if (targetType === 'D') {
      const decimal = require('../utils/decimal');
      const resultingBase = parsed.base_price !== undefined ? parsed.base_price : decimal.decimalToNumber(existing.base_price, undefined);
      if (resultingBase === null || resultingBase === undefined || resultingBase <= 0) {
        return res.status(400).json({ error: 'base_price must be provided and > 0 for DISCOUNTED pricing (type D)' });
      }
    }

    // If the resulting pricing type is DYNAMIC (type 'E'), require avl_times to be present (either in patch or existing) and ensure windows intersect availability times
    if (targetType === 'E') {
      const effectiveAvl = parsed.avl_times ? parsed.avl_times : existing.avl_times;
      if (!effectiveAvl || !Array.isArray(effectiveAvl) || effectiveAvl.length === 0) {
        return res.status(400).json({ error: 'DYNAMIC pricing (type E) requires avl_times to be present (either in request or already set on the item).' });
      }

      const configToCheck = parsed.type_of_pricing === 'E' ? parsed.price_config : (parsed.price_config ?? existing.price_config);
      if (!configToCheck || !configToCheck.config || !Array.isArray(configToCheck.config.windows) || configToCheck.config.windows.length === 0) {
        return res.status(400).json({ error: 'DYNAMIC pricing requires a non-empty "windows" array in price_config' });
      }

      const toMinutes = (s: string) => { const [hh, mm] = s.split(':').map(n => parseInt(n,10)); return hh*60 + mm; };
      const windows = configToCheck.config.windows as Array<any>;
      // For patches, ensure every dynamic window is fully contained within one of the effective avl_times
      const allContained = windows.every((w: any) => {
        const wStart = toMinutes(w.start); const wEnd = toMinutes(w.end);
        return (effectiveAvl as any[]).some((a: any) => {
          const aStart = toMinutes(a.start); const aEnd = toMinutes(a.end);
          return wStart >= aStart && wEnd <= aEnd;
        });
      });

      if (!allContained) return res.status(400).json({ error: "Each DYNAMIC pricing window must be contained within one of the item's avl_times for this patch." });
    }

    // Validate and normalize price_config if present in patch.
    // If changing to type 'A' (STATIC), clear any existing price_config and rely on base_price.
    // If changing to type 'C' (COMPLIMENTARY), base_price will be set to 0 and price_config normalized.
    if (parsed.type_of_pricing) {
      const typeKey = parsed.type_of_pricing as any;
      if (typeKey === 'A') {
        data.type_of_pricing = typeKey;
        data.price_config = null;
      } else if (typeKey === 'C') {
        data.type_of_pricing = typeKey;
        data.price_config = require('../services/price_config').normalizePriceConfig(typeKey, {}, parsed.base_price ?? undefined);
        data.base_price = 0;
      } else if (typeKey === 'D') {
        data.type_of_pricing = typeKey;
        try {
          const norm = require('../services/price_config').normalizePriceConfig(typeKey, parsed.price_config, parsed.base_price ?? undefined);
          data.price_config = norm;
        } catch (e: any) {
          return res.status(400).json({ error: `Invalid price_config: ${e.message}` });
        }
      } else {
        try {
          const norm = require('../services/price_config').normalizePriceConfig(typeKey, parsed.price_config, parsed.base_price ?? undefined);
          data.type_of_pricing = typeKey;
          data.price_config = norm;
        } catch (e: any) {
          return res.status(400).json({ error: `Invalid price_config: ${e.message}` });
        }
      }
    } else if (parsed.price_config) {
      return res.status(400).json({ error: 'price_config provided but type_of_pricing is missing' });
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

export const bulkUpdatePriceConfig = async (req: Request, res: Response) => {
  try {
    const parsed = z.object({
      categoryId: z.string().optional(),
      subcategoryId: z.string().optional(),
      types: z.array(z.enum(['A','B','C','D','E'])).nonempty(),
      configs: z.record(z.string(), z.any())
    }).parse(req.body);

    const { categoryId, subcategoryId, types, configs } = parsed;

    if ((!categoryId && !subcategoryId) || (categoryId && subcategoryId)) {
      return res.status(400).json({ error: 'Provide exactly one of categoryId or subcategoryId' });
    }

    const normalize = require('../services/price_config').normalizePriceConfig;

    const results: Array<{ type: string; updated: number; skipped?: number }> = [];

    await prisma.$transaction(async (tx) => {
      for (const t of types) {
        const configPayload = configs[t];
        if (typeof configPayload === 'undefined') {
          throw new Error(`Missing price_config for type '${t}'`);
        }

        // Build where clause for this parent + type
        const where: any = { type_of_pricing: t };
        if (categoryId) where.categoryId = categoryId;
        if (subcategoryId) where.subcategoryId = subcategoryId;

        // Special handling & validation for types
        if (t === 'A') {
          // Static: clear price_config
          const u = await tx.item.updateMany({ where, data: { price_config: null as any } });
          results.push({ type: t, updated: u.count });
          continue;
        }

        // For DISCOUNTED, ensure all target items have base_price > 0
        if (t === 'D') {
          const invalidCount = await tx.item.count({ where: { ...where, OR: [{ base_price: null }, { base_price: { lte: 0 } }] } });
          if (invalidCount > 0) {
            throw new Error(`There are ${invalidCount} item(s) with missing or non-positive base_price for DISCOUNTED pricing (type D). Ensure base_price > 0 before applying discounted configs.`);
          }
        }

        // Normalize config (will throw if invalid)
        const norm = normalize(t as any, configPayload, undefined);

        // Update data depending on type
        const data: any = { price_config: norm };
        if (t === 'C') {
          data.base_price = 0; // complimentary
        }

        const u = await tx.item.updateMany({ where, data });
        results.push({ type: t, updated: u.count });
      }
    });

    res.json({ success: true, results });

  } catch (err: any) {
    const message = err instanceof z.ZodError ? err.issues : err.message;
    res.status(400).json({ error: message });
  }
};
