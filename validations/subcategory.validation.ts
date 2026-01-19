import { z } from 'zod';
import { taxValidation, decimalValidator } from './common.validation';

/**
 * Subcategory validation schemas
 */

export const createSubcategorySchema = z.object({
  categoryId: z.string().min(1, 'Category ID is required'),
  name: z.string().min(1, 'Subcategory name is required'),
  image: z.string().url().optional().or(z.literal('')),
  description: z.string().optional(),
  tax_applicable: z.boolean().optional(),
  tax_percentage: decimalValidator.optional(),
  is_tax_inherit: z.boolean().optional(),
  is_active: z.boolean().optional().default(true)
});

export const updateSubcategorySchema = z.object({
  categoryId: z.string().min(1, 'Category ID is required').optional(),
  name: z.string().min(1, 'Subcategory name is required').optional(),
  image: z.string().url().optional().or(z.literal('')),
  description: z.string().optional(),
  tax_applicable: z.boolean().optional(),
  tax_percentage: decimalValidator.optional(),
  is_tax_inherit: z.boolean().optional(),
  is_active: z.boolean().optional()
});

export const listSubcategoriesQuerySchema = z.object({
  page: z.string().optional().default('1').transform(Number),
  limit: z.string().optional().default('10').transform(Number),
  sortBy: z.string().optional().default('createdAt'),
  sortDir: z.enum(['asc', 'desc']).optional().default('desc'),
  categoryId: z.string().optional(),
  activeOnly: z.enum(['true', 'false']).optional().default('true'),
  taxApplicable: z.enum(['true', 'false']).optional(),
}).transform((data) => ({
  page: Math.max(1, data.page),
  limit: Math.max(1, data.limit),
  sortBy: data.sortBy,
  sortDir: data.sortDir,
  categoryId: data.categoryId,
  activeOnly: data.activeOnly === 'true',
  taxApplicable: data.taxApplicable === 'true' ? true : data.taxApplicable === 'false' ? false : undefined
}));

export type CreateSubcategoryDTO = z.infer<typeof createSubcategorySchema>;
export type UpdateSubcategoryDTO = z.infer<typeof updateSubcategorySchema>;
export type ListSubcategoriesQueryDTO = z.infer<typeof listSubcategoriesQuerySchema>;
