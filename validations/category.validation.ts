import { z } from 'zod';
import { taxValidation, decimalValidator } from './common.validation';

/**
 * Category validation schemas
 */

export const createCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required'),
  image: z.string().url().optional().or(z.literal('')),
  description: z.string().optional(),
  tax_applicable: z.boolean().optional(),
  tax_percentage: decimalValidator.optional(),
  is_active: z.boolean().optional().default(true)
});

export const updateCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required').optional(),
  image: z.string().url().optional().or(z.literal('')),
  description: z.string().optional(),
  tax_applicable: z.boolean().optional(),
  tax_percentage: decimalValidator.optional(),
  is_active: z.boolean().optional()
});

export const listCategoriesQuerySchema = z.object({
  page: z.string().optional().default('1').transform(Number),
  limit: z.string().optional().default('10').transform(Number),
  sortBy: z.string().optional().default('createdAt'),
  sortDir: z.enum(['asc', 'desc']).optional().default('desc'),
  activeOnly: z.enum(['true', 'false']).optional().default('true'),
}).transform((data) => ({
  page: Math.max(1, data.page),
  limit: Math.max(1, data.limit),
  sortBy: data.sortBy,
  sortDir: data.sortDir,
  activeOnly: data.activeOnly === 'true'
}));

export type CreateCategoryDTO = z.infer<typeof createCategorySchema>;
export type UpdateCategoryDTO = z.infer<typeof updateCategorySchema>;
export type ListCategoriesQueryDTO = z.infer<typeof listCategoriesQuerySchema>;
