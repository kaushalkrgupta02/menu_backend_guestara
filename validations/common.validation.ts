import { z } from 'zod';

/**
 * Common reusable validators across all entities
 */

// Decimal precision validator (2 decimal places)
export const decimalValidator = z.number()
  .refine(
    (n) => Number.isFinite(n) && Math.round(n * 100) === Math.round(n * 100),
    { message: 'Must have at most 2 decimal places' }
  );

// Tax validation - ensures consistency between tax_applicable and tax_percentage
export const taxValidation = z.object({
  tax_applicable: z.boolean().optional(),
  tax_percentage: decimalValidator.optional(),
}).refine(
  (data) => {
    if (data.tax_applicable === false && data.tax_percentage && data.tax_percentage > 0) {
      return false;
    }
    if (data.tax_applicable === true && (!data.tax_percentage || data.tax_percentage <= 0)) {
      return false;
    }
    return true;
  },
  { message: 'If tax_applicable is true, tax_percentage must be > 0; if false, must be 0' }
);

// Parent validation - item can belong to either category or subcategory, not both
export const parentValidation = z.object({
  categoryId: z.string().optional(),
  subcategoryId: z.string().optional(),
}).refine(
  (data) => !(data.categoryId && data.subcategoryId),
  { message: 'Item must belong to either category or subcategory, not both' }
);

// Pagination query parameters
export const paginationQuery = z.object({
  page: z.string().optional().default('1').transform(Number),
  limit: z.string().optional().default('10').transform(Number),
  sortBy: z.string().optional().default('createdAt'),
  sortDir: z.enum(['asc', 'desc']).optional().default('desc'),
}).transform((data) => ({
  page: Math.max(1, data.page),
  limit: Math.max(1, data.limit),
  sortBy: data.sortBy,
  sortDir: data.sortDir
}));

// Common response error handler
export const handleValidationError = (error: unknown) => {
  if (error instanceof z.ZodError) {
    return {
      error: 'Validation failed',
      issues: error.issues.map(issue => ({
        path: issue.path.join('.'),
        message: issue.message
      }))
    };
  }
  return { error: (error as Error).message };
};
