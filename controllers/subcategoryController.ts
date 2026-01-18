import { Request, Response } from 'express';
import { getPrisma } from '../config/prisma_client';
import { z } from 'zod';
import { formatTimestampToLocal } from '../utils/time';
import {
  createSubcategorySchema,
  updateSubcategorySchema,
  listSubcategoriesQuerySchema,
  CreateSubcategoryDTO,
  UpdateSubcategoryDTO,
  ListSubcategoriesQueryDTO
} from '../validations/subcategory.validation';
import { handleValidationError } from '../validations/common.validation';
import { formatSubcategory, formatPaginatedResponse } from '../dto/formatters';

const prisma = getPrisma();

export const createSubcategory = async (req: Request, res: Response) => {
  try {
    const parsed = createSubcategorySchema.parse(req.body);

    // Name uniqueness check within category
    const existing = await prisma.subcategory.findFirst({
      where: {
        name: parsed.name,
        categoryId: parsed.categoryId
      }
    });
    if (existing) {
      return res.status(400).json({ error: 'Subcategory name must be unique within its category' });
    }

    // Verify category exists
    const category = await prisma.category.findUnique({ where: { id: parsed.categoryId } });
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Determine tax inheritance
    const isTaxInherit = parsed.tax_applicable === undefined && parsed.tax_percentage === undefined;

    const subcategory = await prisma.subcategory.create({
      data: {
        categoryId: parsed.categoryId,
        name: parsed.name,
        image: parsed.image,
        description: parsed.description,
        tax_applicable: isTaxInherit ? null : parsed.tax_applicable,
        tax_percentage: isTaxInherit ? null : parsed.tax_percentage,
        is_tax_inherit: isTaxInherit,
        is_active: parsed.is_active
      }
    });

    res.status(201).json({
      ...subcategory,
      createdAt: formatTimestampToLocal(subcategory.createdAt),
      updatedAt: formatTimestampToLocal(subcategory.updatedAt)
    });
  } catch (err) {
    console.error(err);
    res.status(400).json(handleValidationError(err));
  }
};

export const listSubcategories = async (req: Request, res: Response) => {
  try {
    const query = listSubcategoriesQuerySchema.parse(req.query);
    const { page, limit, sortBy, sortDir, categoryId, activeOnly, taxApplicable } = query;

    const where: any = {};
    if (categoryId) where.categoryId = categoryId;
    if (activeOnly) where.is_active = true;

    // Tax applicable filtering with inheritance support
    if (taxApplicable !== undefined) {
      if (taxApplicable) {
        where.OR = [
          { AND: [{ is_tax_inherit: true }, { category: { tax_applicable: true } }] },
          { AND: [{ is_tax_inherit: false }, { tax_applicable: true }] }
        ];
      } else {
        where.AND = [
          { OR: [{ is_tax_inherit: false }, { category: { tax_applicable: false } }] },
          { tax_applicable: { not: true } }
        ];
      }
    }

    const [total, subcategories] = await prisma.$transaction([
      prisma.subcategory.count({ where }),
      prisma.subcategory.findMany({
        where,
        orderBy: { [sortBy]: sortDir },
        skip: (page - 1) * limit,
        take: limit
      })
    ]);

    const formattedSubcategories = subcategories.map(formatSubcategory);
    res.json(formatPaginatedResponse(formattedSubcategories, page, limit, total, item => item));
  } catch (err) {
    console.error(err);
    res.status(400).json(handleValidationError(err));
  }
};

export const getSubcategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const subcategory = await prisma.subcategory.findUnique({
      where: { id },
      include: {
        category: true,
        items: true
      }
    });

    if (!subcategory) return res.status(404).json({ error: 'Subcategory not found' });

    const decimal = require('../utils/decimal');

    const formattedSub = {
      ...subcategory,
      tax_percentage: decimal.decimalToNumber(subcategory.tax_percentage, 0),
      createdAt: formatTimestampToLocal(subcategory.createdAt),
      updatedAt: formatTimestampToLocal(subcategory.updatedAt)
    };

    const formattedCategory = subcategory.category ? {
      ...subcategory.category,
      tax_percentage: decimal.decimalToNumber(subcategory.category.tax_percentage, 0),
      createdAt: formatTimestampToLocal(subcategory.category.createdAt),
      updatedAt: formatTimestampToLocal(subcategory.category.updatedAt)
    } : null;

    const formattedItems = subcategory.items.map((it) => {
      const itemWithParents = { ...it, category: subcategory.category || null, subcategory };
      const price = (require('../services/price_engine') as any).resolveItemPrice(itemWithParents, {} as any);
      const effectiveActive = require('../utils/visibility').isItemEffectivelyActive(itemWithParents as any);
      return {
        ...it,
        base_price: decimal.decimalToNumber(it.base_price, 0),
        tax_percentage: decimal.decimalToNumber(it.tax_percentage, 0),
        is_active: effectiveActive,
        resolvedPrice: price,
        createdAt: formatTimestampToLocal(it.createdAt),
        updatedAt: formatTimestampToLocal(it.updatedAt)
      };
    });

    res.json({ ...formattedSub, category: formattedCategory, items: formattedItems });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: (err as Error).message });
  }
};

export const patchSubcategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const parsed = z.object({
      categoryId: z.string().optional(),
      name: z.string().optional(),
      image: z.string().optional(),
      description: z.string().optional(),
      tax_applicable: z.boolean().optional(),
      tax_percentage: z.number().optional().refine((n) => n === undefined || (Number.isFinite(n) && Math.round(n * 100) === Math.round(n * 100)), { message: 'tax_percentage must have at most 2 decimal places' }),
      is_tax_inherit: z.boolean().optional(),
      is_active: z.boolean().optional()
    }).parse(req.body);

    const existing = await prisma.subcategory.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Subcategory not found' });

    // If categoryId is changing, ensure new category exists
    if (parsed.categoryId && parsed.categoryId !== existing.categoryId) {
      const cat = await prisma.category.findUnique({ where: { id: parsed.categoryId } });
      if (!cat) return res.status(404).json({ error: 'Target category not found' });
    }

    // If name changes, ensure uniqueness within target category
    const targetCategoryId = parsed.categoryId ?? existing.categoryId;
    if (parsed.name && parsed.name !== existing.name) {
      const dup = await prisma.subcategory.findFirst({ where: { name: parsed.name, categoryId: targetCategoryId } });
      if (dup) return res.status(400).json({ error: 'Subcategory name must be unique within its category' });
    }

    // Determine whether tax settings changed and validate
    const decimal = require('../utils/decimal');
    const prevIsInherit = !!existing.is_tax_inherit;
    const newIsInherit = parsed.is_tax_inherit !== undefined ? parsed.is_tax_inherit : prevIsInherit;

    const prevTaxApp = existing.tax_applicable;
    const prevTaxPct = decimal.decimalToNumber(existing.tax_percentage, 0);

    const newTaxApp = parsed.tax_applicable !== undefined ? parsed.tax_applicable : existing.tax_applicable;
    const newTaxPct = parsed.tax_percentage !== undefined ? parsed.tax_percentage : prevTaxPct;

    if (newIsInherit === false) {
      // explicit tax must be valid
      if (newTaxApp === false && newTaxPct && newTaxPct > 0) throw new Error('If tax_applicable is false, tax_percentage must be 0');
      if (newTaxApp === true && (!newTaxPct || newTaxPct <= 0)) throw new Error('If tax_applicable is true, tax_percentage must be greater than 0');
    }
    const updated = await prisma.$transaction(async (tx) => {
      const sub = await tx.subcategory.update({ where: { id }, data: parsed });

      // If tax-related settings changed, update items that inherit
      const taxChanged = (parsed.is_tax_inherit !== undefined && parsed.is_tax_inherit !== prevIsInherit) ||
                         (parsed.tax_applicable !== undefined && parsed.tax_applicable !== prevTaxApp) ||
                         (parsed.tax_percentage !== undefined && parsed.tax_percentage !== prevTaxPct);

      if (taxChanged) {
        // Clear tax fields on items under this subcategory that inherit
        await tx.item.updateMany({ where: { subcategoryId: id, is_tax_inherit: true }, data: { tax_percentage: null, tax_applicable: null } });
      }

      return sub;
    });

    res.json({
      ...updated,
      createdAt: formatTimestampToLocal(updated.createdAt),
      updatedAt: formatTimestampToLocal(updated.updatedAt)
    });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: (err as Error).message });
  }
};

export const deactivateSubcategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    await prisma.$transaction([
      prisma.subcategory.update({ where: { id }, data: { is_active: false } }),
      prisma.item.updateMany({ where: { subcategoryId: id }, data: { is_active: false } })
    ]);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: (err as Error).message });
  }
};
