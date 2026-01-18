import { z } from 'zod';
import { taxValidation, decimalValidator, parentValidation } from './common.validation';

/**
 * Item validation schemas
 */

export const createItemSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  description: z.string().optional(),
  image: z.string().url().optional().or(z.literal('')),
  categoryId: z.string().optional(),
  subcategoryId: z.string().optional(),
  base_price: z.number().nonnegative('Price cannot be negative').default(0).refine(
    (n) => Number.isFinite(n) && Math.round(n * 100) === Math.round(n * 100),
    { message: 'base_price must have at most 2 decimal places' }
  ),
  type_of_pricing: z.enum(['A', 'B', 'C', 'D', 'E']).optional(),
  price_config: z.any().optional(),
  is_tax_inherit: z.boolean().optional(),
  tax_applicable: z.boolean().optional(),
  tax_percentage: decimalValidator.optional(),
  avl_days: z.array(z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])).optional(),
  avl_times: z.array(z.object({
    start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Invalid time format HH:mm'),
    end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Invalid time format HH:mm')
  })).optional(),
  is_bookable: z.boolean().optional().default(false),
  is_active: z.boolean().optional().default(true)
});

export const updateItemSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').optional(),
  description: z.string().optional(),
  image: z.string().url().optional().or(z.literal('')),
  categoryId: z.string().optional(),
  subcategoryId: z.string().optional(),
  base_price: z.number().nonnegative('Price cannot be negative').optional(),
  type_of_pricing: z.enum(['A', 'B', 'C', 'D', 'E']).optional(),
  price_config: z.any().optional(),
  is_tax_inherit: z.boolean().optional(),
  tax_applicable: z.boolean().optional(),
  tax_percentage: decimalValidator.optional(),
  avl_days: z.array(z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])).optional(),
  avl_times: z.array(z.object({
    start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Invalid time format HH:mm'),
    end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Invalid time format HH:mm')
  })).optional(),
  is_bookable: z.boolean().optional(),
  is_active: z.boolean().optional()
});

export const listItemsQuerySchema = z.object({
  page: z.string().optional().default('1').transform(Number),
  limit: z.string().optional().default('10').transform(Number),
  sortBy: z.enum(['name', 'price', 'createdAt']).optional().default('createdAt'),
  sortDir: z.enum(['asc', 'desc']).optional().default('desc'),
  q: z.string().optional(),
  categoryId: z.string().optional(),
  minPrice: z.string().optional().transform(v => v ? parseFloat(v) : undefined),
  maxPrice: z.string().optional().transform(v => v ? parseFloat(v) : undefined),
  taxApplicable: z.enum(['true', 'false']).optional(),
  activeOnly: z.enum(['true', 'false']).optional().default('true'),
}).transform((data) => ({
  page: Math.max(1, data.page),
  limit: Math.max(1, data.limit),
  sortBy: data.sortBy,
  sortDir: data.sortDir,
  q: data.q,
  categoryId: data.categoryId,
  minPrice: data.minPrice,
  maxPrice: data.maxPrice,
  taxApplicable: data.taxApplicable === 'true' ? true : data.taxApplicable === 'false' ? false : undefined,
  activeOnly: data.activeOnly === 'true'
}));

export const filterItemsQuerySchema = z.object({
  page: z.string().optional().default('1').transform(Number),
  limit: z.string().optional().default('10').transform(Number),
  sortBy: z.enum(['name', 'price', 'createdAt']).optional().default('createdAt'),
  sortDir: z.enum(['asc', 'desc']).optional().default('desc'),
  categoryActive: z.enum(['true', 'false']).optional(),
  subcategoryActive: z.enum(['true', 'false']).optional(),
  minPrice: z.string().optional().transform(v => v ? parseFloat(v) : undefined),
  maxPrice: z.string().optional().transform(v => v ? parseFloat(v) : undefined),
  taxApplicable: z.enum(['true', 'false']).optional(),
}).transform((data) => ({
  page: Math.max(1, data.page),
  limit: Math.max(1, data.limit),
  sortBy: data.sortBy,
  sortDir: data.sortDir,
  categoryActive: data.categoryActive === 'true' ? true : data.categoryActive === 'false' ? false : undefined,
  subcategoryActive: data.subcategoryActive === 'true' ? true : data.subcategoryActive === 'false' ? false : undefined,
  minPrice: data.minPrice,
  maxPrice: data.maxPrice,
  taxApplicable: data.taxApplicable === 'true' ? true : data.taxApplicable === 'false' ? false : undefined,
}));

export type CreateItemDTO = z.infer<typeof createItemSchema>;
export type UpdateItemDTO = z.infer<typeof updateItemSchema>;
export type ListItemsQueryDTO = z.infer<typeof listItemsQuerySchema>;
export type FilterItemsQueryDTO = z.infer<typeof filterItemsQuerySchema>;
