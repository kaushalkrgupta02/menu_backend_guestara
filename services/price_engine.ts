// services/pricing.service.ts

export type PricingTypeKey = 'A' | 'B' | 'C' | 'D' | 'E';

export const PRICING_TYPES: {
    key: PricingTypeKey;
    label: string;
    type: 'STATIC' | 'TIERED' | 'COMPLIMENTARY' | 'DISCOUNTED' | 'DYNAMIC';
}[] = [
    { key: 'A', label: 'Static Pricing', type: 'STATIC' },
    { key: 'B', label: 'Tiered Pricing', type: 'TIERED' },
    { key: 'C', label: 'Complimentary', type: 'COMPLIMENTARY' },
    { key: 'D', label: 'Discounted Pricing', type: 'DISCOUNTED' },
    { key: 'E', label: 'Dynamic Pricing (Time-based)', type: 'DYNAMIC' },
];

export const PRICING_TYPE_BY_KEY: Record<PricingTypeKey, string> = PRICING_TYPES.reduce(
    (acc, p) => {
        acc[p.key] = p.type;
        return acc;
    },
    {} as Record<PricingTypeKey, string>
);




export const resolveItemPrice = (item: any, context: { usageHours?: number, currentTime?: string }) => {
  // If price_config is not defined, fall back to using base_price (simple STATIC behavior)
  const now = context.currentTime ? new Date(context.currentTime) : new Date();

  const resolveTax = (item: any) => {
    // Resolve tax respecting is_tax_inherit flags on item and subcategory
    if (!item) return { taxPercentage: 0, taxApplicable: false };

    const decimal = require('../utils/decimal');
    if (item.is_tax_inherit === false) {
      return { taxPercentage: decimal.decimalToNumber(item.tax_percentage ?? 0), taxApplicable: !!item.tax_applicable };
    }

    if (item.subcategory) {
      if (item.subcategory.is_tax_inherit === false) {
        return { taxPercentage: decimal.decimalToNumber(item.subcategory.tax_percentage ?? 0), taxApplicable: !!item.subcategory.tax_applicable };
      }
      if (item.subcategory.category) {
        return { taxPercentage: decimal.decimalToNumber(item.subcategory.category.tax_percentage ?? 0), taxApplicable: !!item.subcategory.category.tax_applicable };
      }
    }

    if (item.category) {
      return { taxPercentage: decimal.decimalToNumber(item.category.tax_percentage ?? 0), taxApplicable: !!item.category.tax_applicable };
    }

    return { taxPercentage: 0, taxApplicable: false };
  };

  if (!item || !item.price_config) {
    const basePrice = typeof item?.base_price === 'number' ? item.base_price : require('../utils/decimal').decimalToNumber(item?.base_price, 0);
    const discount = 0;
    const isAvailable = true;

    const { taxPercentage } = resolveTax(item);

    const finalBase = Math.max(0, basePrice - discount);
    const taxAmount = (finalBase * taxPercentage) / 100;

    return {
      isAvailable,
      pricingType: 'STATIC',
      basePrice: require('../utils/decimal').roundTo2(basePrice),
      discount: require('../utils/decimal').roundTo2(discount),
      taxPercentage: require('../utils/decimal').roundTo2(taxPercentage),
      taxAmount: require('../utils/decimal').roundTo2(taxAmount),
      grandTotal: require('../utils/decimal').roundTo2(finalBase + taxAmount)
    };
  }

  const { type, config } = item.price_config;
  let basePrice = 0;
  let discount = 0;
  let isAvailable = true;

  switch (type) {
    case 'STATIC':
      basePrice = config.amount;
      break;

    case 'TIERED':
      // Find the first tier where usage is less than or equal to tier limit
      const tier = config.tiers.find((t: any) => context.usageHours! <= t.upto_hours);
      basePrice = tier ? tier.price : config.tiers[config.tiers.length - 1].price;
      break;

    case 'COMPLIMENTARY':
      basePrice = 0;
      break;

    case 'DISCOUNTED':
      basePrice = config.base_price;
      discount = config.is_percentage 
        ? (basePrice * (config.discount_value / 100)) 
        : config.discount_value;
      break;

    case 'DYNAMIC':
      // Format: "08:00"
      const timeStr = now.getHours().toString().padStart(2, '0') + ":" + now.getMinutes().toString().padStart(2, '0');
      const window = config.windows.find((w: any) => timeStr >= w.start && timeStr <= w.end);
      if (window) {
        basePrice = window.price;
      } else {
        isAvailable = false; // "After 11:00 -> unavailable" logic
      }
      break;
  }

  // Resolve Inherited Tax
  const { taxPercentage } = resolveTax(item);

  const finalBase = Math.max(0, basePrice - discount);
  const taxAmount = (finalBase * taxPercentage) / 100;

  return {
    isAvailable,
    pricingType: type,
    basePrice: require('../utils/decimal').roundTo2(basePrice),
    discount: require('../utils/decimal').roundTo2(discount),
    taxPercentage: require('../utils/decimal').roundTo2(taxPercentage),
    taxAmount: require('../utils/decimal').roundTo2(taxAmount),
    grandTotal: require('../utils/decimal').roundTo2(finalBase + taxAmount)
  };
};