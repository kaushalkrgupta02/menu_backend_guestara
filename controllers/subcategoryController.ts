import { Request, Response } from 'express';
import { getPrisma } from '../config/prisma_client';
import { z } from 'zod';
import { formatTimestampToLocal } from '../utils/time';

const prisma = getPrisma();

export const createSubcategory = async (req: Request, res: Response) => {
  try {
    const parsed = z.object({
      categoryId: z.string(),
      name: z.string(),
      image: z.string().optional(),
      description: z.string().optional(),
      tax_applicable: z.boolean().optional(),
      tax_percentage: z.number().optional(),
      is_active: z.boolean().optional()
    }).parse(req.body);

    //name uniqueness within category
    const existing = await prisma.subcategory.findFirst({
      where: {
        name: parsed.name,
        categoryId: parsed.categoryId
        }
    });
    if (existing) {
        return res.status(400).json({ error: 'Subcategory name must be unique within its category' });
    }



    // Determine tax inheritance: if tax fields are not provided, mark subcategory as inheriting and leave tax fields null
    let isTaxInherit = true;
    let tax_applicable: boolean | undefined = parsed.tax_applicable;
    let tax_percentage: number | undefined = parsed.tax_percentage;

    if (parsed.tax_applicable !== undefined || parsed.tax_percentage !== undefined) {
      // explicit tax provided => do not inherit
      isTaxInherit = false;
    } else {
      // no explicit tax: ensure parent exists; subcategory will inherit at runtime
      const category = await prisma.category.findUnique({ where: { id: parsed.categoryId } });
      if (!category) return res.status(404).json({ error: 'Category not found' });
      tax_applicable = undefined;
      tax_percentage = undefined;
    }

    const subcategory = await prisma.subcategory.create({
      data: {
        categoryId: parsed.categoryId,
        name: parsed.name,
        image: parsed.image,
        description: parsed.description,
        tax_applicable: isTaxInherit ? null as any : tax_applicable,
        tax_percentage: isTaxInherit ? null as any : (tax_percentage as any),
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
    res.status(400).json({ error: (err as Error).message });
  }
};

export const listSubcategories = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, parseInt(req.query.limit as string) || 10);
    const sortBy = (req.query.sortBy as string) || 'createdAt';
    const sortDir = ((req.query.sortDir as string) || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';
    const categoryId = req.query.categoryId as string | undefined;
    const activeOnly = req.query.activeOnly !== 'false';

    const where: any = {};
    if (categoryId) where.categoryId = categoryId;
    if (activeOnly) where.is_active = true;

    const [total, subcategories] = await prisma.$transaction([
      prisma.subcategory.count({ where }),
      prisma.subcategory.findMany({
        where,
        orderBy: { [sortBy]: sortDir },
        skip: (page - 1) * limit,
        take: limit
      })
    ]);

    const items = subcategories.map((r) => ({
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

    const formattedSub = {
      ...subcategory,
      createdAt: formatTimestampToLocal(subcategory.createdAt),
      updatedAt: formatTimestampToLocal(subcategory.updatedAt)
    };

    const formattedCategory = subcategory.category ? {
      ...subcategory.category,
      createdAt: formatTimestampToLocal(subcategory.category.createdAt),
      updatedAt: formatTimestampToLocal(subcategory.category.updatedAt)
    } : null;

    const formattedItems = subcategory.items.map((it) => {
      const itemWithParents = { ...it, category: subcategory.category || null, subcategory };
      const price = (require('../services/price_engine') as any).resolveItemPrice(itemWithParents, {} as any);
      return {
        ...it,
        is_active: !!it.is_active && !!subcategory.is_active && (subcategory.category ? !!subcategory.category.is_active : true),
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
