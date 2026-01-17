import { Request, Response } from 'express';
import { getPrisma } from '../config/prisma_client';
import { z } from 'zod';
import { formatTimestampToLocal } from '../utils/time';

const prisma = getPrisma();

export const createCategory = async (req: Request, res: Response) => {
  try {
    const parsed = z.object({
      name: z.string(),
      image: z.string().optional(),
      description: z.string().optional(),
      tax_applicable: z.boolean().optional(),
      tax_percentage: z.number().optional(),
      is_active: z.boolean().optional()
    }).parse(req.body);

    // if tax_applicable is false, tax_percentage must be 0 and vice versa
    if (parsed.tax_applicable === false && parsed.tax_percentage && parsed.tax_percentage > 0.0) {
      throw new Error('If tax_applicable is false, tax_percentage must be 0');
    }
    if (parsed.tax_applicable === true && (!parsed.tax_percentage || parsed.tax_percentage <= 0.0)) {
      throw new Error('If tax_applicable is true, tax_percentage must be greater than 0');
    }

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
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: (err as Error).message });
  }
};

export const listCategories = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, parseInt(req.query.limit as string) || 10);
    const sortBy = (req.query.sortBy as string) || 'createdAt';
    const sortDir = ((req.query.sortDir as string) || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';
    const activeOnly = req.query.activeOnly !== 'false';

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

    const items = categories.map((r) => ({
      ...r,
      createdAt: formatTimestampToLocal(r.createdAt),
      updatedAt: formatTimestampToLocal(r.updatedAt)
    }));

    res.json({ page, limit, total, items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: (err as Error).message });
  }
};

export const getCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        subcategories: true,
        items: true
      }
    });

    if (!category) return res.status(404).json({ error: 'Category not found' });

    const formattedSubs = category.subcategories.map((s) => ({
      ...s,
      createdAt: formatTimestampToLocal(s.createdAt),
      updatedAt: formatTimestampToLocal(s.updatedAt)
    }));

    const formattedItems = category.items.map((it) => {
      const itemWithParents = { ...it, category, subcategory: null };
      const price = (require('../services/price_engine') as any).resolveItemPrice(itemWithParents, {} as any);
      const effectiveActive = require('../utils/visibility').isItemEffectivelyActive(itemWithParents as any);
      return {
        ...it,
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
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: (err as Error).message });
  }
};

export const patchCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const parsed = z.object({
      name: z.string().optional(),
      image: z.string().optional(),
      description: z.string().optional(),
      tax_applicable: z.boolean().optional(),
      tax_percentage: z.number().optional(),
      is_active: z.boolean().optional()
    }).parse(req.body);

    const existing = await prisma.category.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Category not found' });

    // 1. Validation Logic
    const newTaxApplicable = parsed.tax_applicable !== undefined ? parsed.tax_applicable : existing.tax_applicable;
    const newTaxPercentage = parsed.tax_percentage !== undefined ? parsed.tax_percentage : existing.tax_percentage;

    if (newTaxApplicable === false && newTaxPercentage > 0) {
      throw new Error('If tax_applicable is false, tax_percentage must be 0');
    }
    if (newTaxApplicable === true && (!newTaxPercentage || newTaxPercentage <= 0)) {
      throw new Error('If tax_applicable is true, tax_percentage must be greater than 0');
    }

    // 2. Perform updates in a Transaction to ensure consistency
    const updatedCategory = await prisma.$transaction(async (tx) => {
      // Update the category itself
      const category = await tx.category.update({ 
        where: { id }, 
        data: parsed 
      });


      // B. Handle Tax Cascade
      const taxChanged = (parsed.tax_applicable !== undefined && parsed.tax_applicable !== existing.tax_applicable) ||
                         (parsed.tax_percentage !== undefined && parsed.tax_percentage !== existing.tax_percentage);

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
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: (err as Error).message });
  }
};

export const deactivateCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    await prisma.$transaction([
      prisma.category.update({ where: { id }, data: { is_active: false } }),
      prisma.subcategory.updateMany({ where: { categoryId: id }, data: { is_active: false } }),
      prisma.item.updateMany({ where: { categoryId: id }, data: { is_active: false } })
    ]);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: (err as Error).message });
  }
};
