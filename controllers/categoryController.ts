import { Request, Response, NextFunction } from 'express';
import { getPrisma } from '../config/prisma_client';
import { z } from 'zod';
import { formatTimestampToLocal } from '../utils/time';
import { asyncHandler } from '../middleware/errorHandler';
import { 
  createCategorySchema, 
  updateCategorySchema,
  listCategoriesQuerySchema,
  CreateCategoryDTO,
  UpdateCategoryDTO,
  ListCategoriesQueryDTO
} from '../validations/category.validation';
import { formatCategory, formatPaginatedResponse } from '../dto/formatters';
import { NotFoundError, BadRequestError } from '../utils/errors';

const prisma = getPrisma();

export const createCategory = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const parsed: CreateCategoryDTO = createCategorySchema.parse(req.body);

  const category = await prisma.category.create({
    data: {
      name: parsed.name,
      image: parsed.image,
      description: parsed.description,
      tax_applicable: parsed.tax_applicable,
      tax_percentage: parsed.tax_percentage,
      is_active: parsed.is_active
    }
  });

  res.status(201).json({
    ...category,
    createdAt: formatTimestampToLocal(category.createdAt),
    updatedAt: formatTimestampToLocal(category.updatedAt)
  });
});

export const listCategories = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const query: ListCategoriesQueryDTO = listCategoriesQuerySchema.parse(req.query);
  const { page, limit, sortBy, sortDir, activeOnly } = query;

  const where = activeOnly ? { is_active: true } : {};

  const [total, categories] = await prisma.$transaction([
    prisma.category.count({ where }),
    prisma.category.findMany({
      where,
      orderBy: { [sortBy]: sortDir },
      skip: (page - 1) * limit,
      take: limit
    })
  ]);
  const formattedCategories = categories.map(formatCategory);
  res.json(formatPaginatedResponse(formattedCategories, page, limit, total, item => item));
});

export const getCategory = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const category = await prisma.category.findUnique({
    where: { id },
    include: {
      subcategories: true,
      items: true
    }
  });

  if (!category) throw new NotFoundError('Category', id);

  const decimal = require('../utils/decimal');

  const formattedSubs = category.subcategories.map((s) => ({
    ...s,
    tax_percentage: decimal.decimalToNumber(s.tax_percentage, 0),
    createdAt: formatTimestampToLocal(s.createdAt),
    updatedAt: formatTimestampToLocal(s.updatedAt)
  }));

  const formattedItems = category.items.map((it) => {
    const itemWithParents = { ...it, category, subcategory: null };
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

  res.json({
    ...category,
    subcategories: formattedSubs,
    items: formattedItems,
    createdAt: formatTimestampToLocal(category.createdAt),
    updatedAt: formatTimestampToLocal(category.updatedAt)
  });
});

export const patchCategory = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const parsed: UpdateCategoryDTO = z.object({
    name: z.string().optional(),
    image: z.string().optional(),
    description: z.string().optional(),
    tax_applicable: z.boolean().optional(),
    tax_percentage: z.number().optional().refine((n) => n === undefined || (Number.isFinite(n) && Math.round(n * 100) === Math.round(n * 100)), { message: 'tax_percentage must have at most 2 decimal places' }),
    is_active: z.boolean().optional()
  }).parse(req.body);

  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Category', id);

  // 1. Validation Logic
  const decimal = require('../utils/decimal');
  const newTaxApplicable = parsed.tax_applicable !== undefined ? parsed.tax_applicable : existing.tax_applicable;
  const prevTaxPct = decimal.decimalToNumber(existing.tax_percentage, 0);
  const newTaxPercentage = parsed.tax_percentage !== undefined ? parsed.tax_percentage : prevTaxPct;

  if (newTaxApplicable === false && newTaxPercentage > 0) {
    throw new BadRequestError('If tax_applicable is false, tax_percentage must be 0');
  }
  if (newTaxApplicable === true && (!newTaxPercentage || newTaxPercentage <= 0)) {
    throw new BadRequestError('If tax_applicable is true, tax_percentage must be greater than 0');
  }

  // 2. Perform updates in a Transaction to ensure consistency
  const updatedCategory = await prisma.$transaction(async (tx) => {
    // Update the category itself
    const category = await tx.category.update({ 
      where: { id }, 
      data: parsed 
    });

    // B. Handle Tax Cascade
    const prevTaxPct = decimal.decimalToNumber(existing.tax_percentage, 0);
    const taxChanged = (parsed.tax_applicable !== undefined && parsed.tax_applicable !== existing.tax_applicable) ||
                       (parsed.tax_percentage !== undefined && parsed.tax_percentage !== prevTaxPct);

    if (taxChanged) {
      // 1. Reset Subcategories that are set to inherit
      await tx.subcategory.updateMany({ where: { categoryId: id, is_tax_inherit: true }, data: { tax_percentage: null, tax_applicable: null } });

      // 2. Reset Items directly under Category that inherit
      await tx.item.updateMany({ where: { categoryId: id, is_tax_inherit: true }, data: { tax_percentage: null, tax_applicable: null } });

      // 3. Reset Items under ANY subcategory belonging to this category ONLY if the item itself is marked as inheriting
      const allSubIds = (await tx.subcategory.findMany({ where: { categoryId: id }, select: { id: true } })).map(s => s.id);
      if (allSubIds.length > 0) {
        await tx.item.updateMany({ where: { subcategoryId: { in: allSubIds }, is_tax_inherit: true }, data: { tax_percentage: null, tax_applicable: null } });
      }
    }

    return category;
  });

  res.json({
    ...updatedCategory,
    createdAt: formatTimestampToLocal(updatedCategory.createdAt),
    updatedAt: formatTimestampToLocal(updatedCategory.updatedAt)
  });
});

export const deactivateCategory = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  
  await prisma.$transaction([
    prisma.category.update({ where: { id }, data: { is_active: false } }),
    prisma.subcategory.updateMany({ where: { categoryId: id }, data: { is_active: false } }),
    prisma.item.updateMany({ where: { categoryId: id }, data: { is_active: false } })
  ]);

  res.json({ success: true });
});
