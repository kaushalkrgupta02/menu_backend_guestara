/**
 * Tax Service
 * Centralized logic for tax validation and inheritance
 */

/**
 * Resolve effective tax status for an item based on inheritance and parent settings
 * @param item - Item object with tax settings
 * @param category - Category object (optional)
 * @param subcategory - Subcategory object (optional)
 * @returns Object with effective tax status
 */
export const resolveTaxStatus = (
  item: any,
  category?: any,
  subcategory?: any
) => {
  let effectiveTaxApplicable = item.tax_applicable;
  let effectiveTaxPercentage = item.tax_percentage;

  // If item inherits tax, use parent's tax settings
  if (item.is_tax_inherit) {
    const parentTax = subcategory?.tax_applicable ?? category?.tax_applicable;
    const parentTaxPercentage = subcategory?.tax_percentage ?? category?.tax_percentage;
    
    if (parentTax !== null && parentTax !== undefined) {
      effectiveTaxApplicable = parentTax;
      effectiveTaxPercentage = parentTaxPercentage;
    }
  }

  return {
    tax_applicable: effectiveTaxApplicable,
    tax_percentage: effectiveTaxPercentage,
    is_inherited: item.is_tax_inherit && (subcategory?.tax_applicable || category?.tax_applicable)
  };
};

/**
 * Build Prisma where clause for tax filtering
 * Supports both direct tax checks and inherited tax from parents
 * @param taxApplicable - Boolean to filter by tax status
 * @returns Prisma where clause object
 */
export const buildTaxFilter = (taxApplicable: boolean) => {
  if (taxApplicable) {
    return {
      OR: [
        // Items that inherit tax from active parent
        {
          AND: [
            { is_tax_inherit: true },
            {
              OR: [
                { category: { tax_applicable: true } },
                { subcategory: { tax_applicable: true } }
              ]
            }
          ]
        },
        // Items with own tax_applicable = true
        {
          AND: [
            { is_tax_inherit: false },
            { tax_applicable: true }
          ]
        }
      ]
    };
  } else {
    // Items without tax
    return {
      AND: [
        {
          OR: [
            { is_tax_inherit: false },
            { category: { tax_applicable: false } },
            { subcategory: { tax_applicable: false } }
          ]
        },
        { tax_applicable: { not: true } }
      ]
    };
  }
};

/**
 * Validate tax configuration
 * Ensures tax_percentage is only set when tax_applicable is true
 * @param tax_applicable - Whether tax is applicable
 * @param tax_percentage - Tax percentage value
 * @throws Error if configuration is invalid
 */
export const validateTaxConfig = (tax_applicable: boolean | null | undefined, tax_percentage: any) => {
  if (tax_applicable === true && !tax_percentage) {
    throw new Error('tax_percentage is required when tax_applicable is true');
  }

  if (tax_applicable === false && tax_percentage) {
    throw new Error('tax_percentage should not be set when tax_applicable is false');
  }
};

/**
 * Check if item's tax can be inherited from category or subcategory
 * @param item - Item object
 * @param category - Category object (optional)
 * @param subcategory - Subcategory object (optional)
 * @returns boolean - Whether inheritance is possible
 */
export const canInheritTax = (item: any, category?: any, subcategory?: any) => {
  if (!item.is_tax_inherit) return false;
  
  // Can inherit from subcategory if present
  if (subcategory && subcategory.tax_applicable !== null && subcategory.tax_applicable !== undefined) {
    return true;
  }

  // Can inherit from category if subcategory not present
  if (category && category.tax_applicable !== null && category.tax_applicable !== undefined) {
    return true;
  }

  return false;
};

/**
 * Calculate effective tax amount
 * @param baseAmount - Base amount before tax
 * @param taxPercentage - Tax percentage
 * @returns Tax amount
 */
export const calculateTaxAmount = (baseAmount: number, taxPercentage: number) => {
  if (!taxPercentage) return 0;
  return baseAmount * (taxPercentage / 100);
};

/**
 * Calculate total with tax
 * @param baseAmount - Base amount before tax
 * @param taxPercentage - Tax percentage
 * @returns Total amount including tax
 */
export const calculateTotalWithTax = (baseAmount: number, taxPercentage: number) => {
  const taxAmount = calculateTaxAmount(baseAmount, taxPercentage);
  return baseAmount + taxAmount;
};
