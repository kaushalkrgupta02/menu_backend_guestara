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
  const decimal = require('../utils/decimal');

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
      appliedPricingRule: { type: 'STATIC', source: 'base', amount: require('../utils/decimal').roundTo2(basePrice) },
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
  let appliedPricingRule: string | null = null;

  switch (type) {
    case 'STATIC':
      // For STATIC, prefer item.base_price; otherwise optionally config.amount
      basePrice = typeof item?.base_price === 'number' ? item.base_price : (config.amount !== undefined ? decimal.decimalToNumber(config.amount, 0) : 0);
      appliedPricingRule = { type: 'STATIC', source: 'base', amount: decimal.roundTo2 ? decimal.roundTo2(basePrice) : require('../utils/decimal').roundTo2(basePrice) };
      break;

    case 'TIERED':
      if (!Array.isArray(config.tiers) || config.tiers.length === 0) { isAvailable = false; appliedPricingRule = { type: 'TIERED', error: 'invalid config' }; break; }
      if (context.usageHours !== undefined) {
        // tiers may have `upto: null` meaning unbounded final tier
        const tier = config.tiers.find((t: any) => (t.upto === null) ? true : context.usageHours! <= t.upto);
        basePrice = tier ? tier.price : config.tiers[config.tiers.length - 1].price;
        appliedPricingRule = tier ? { type: 'TIERED', applied: { upto: tier.upto, price: tier.price } } : { type: 'TIERED', applied: { defaultLast: true, price: config.tiers[config.tiers.length - 1].price } };
      } else {
        // No usage provided: default to the last tier's price
        const last = config.tiers[config.tiers.length - 1];
        basePrice = last.price;
        appliedPricingRule = { type: 'TIERED', applied: { defaultLast: true, upto: last.upto, price: last.price } };
      }
      break;

    case 'COMPLIMENTARY':
      basePrice = 0;
      appliedPricingRule = { type: 'COMPLIMENTARY' };
      break;

    case 'DISCOUNTED':
      // Use config.base if provided; otherwise fall back to item.base_price (which may be a Decimal)
      const configBase = typeof config.base !== 'undefined' ? config.base : (typeof item?.base_price === 'number' ? item.base_price : decimal.decimalToNumber(item?.base_price, 0));
      basePrice = configBase ?? 0;
      discount = config.is_perc
        ? (basePrice * (config.val / 100))
        : config.val;
      // Ensure discount bounds: final price should never be negative. For flat discounts, clamp to basePrice.
      if (!config.is_perc && discount > basePrice) discount = basePrice;
      if (discount < 0) discount = 0;
      appliedPricingRule = config.is_perc ? { type: 'DISCOUNTED', val: config.val, is_perc: true } : { type: 'DISCOUNTED', val: config.val, is_perc: false };
      break;

    case 'DYNAMIC':
      // Format: "08:00". Use inclusive start, exclusive end to avoid overlap ambiguity.
      const timeStr = now.getHours().toString().padStart(2, '0') + ":" + now.getMinutes().toString().padStart(2, '0');
      if (!Array.isArray(config.windows) || config.windows.length === 0) { isAvailable = false; appliedPricingRule = { type: 'DYNAMIC', error: 'invalid config' }; break; }
      const window = config.windows.find((w: any) => timeStr >= w.start && timeStr < w.end);
      if (window) {
        basePrice = window.price;
        appliedPricingRule = { type: 'DYNAMIC', applied: { start: window.start, end: window.end, price: window.price } };
      } else {
        isAvailable = false; // not available outside configured windows
        appliedPricingRule = { type: 'DYNAMIC', matched: null };
      }
      break;
  }

  // Resolve Inherited Tax
  const { taxPercentage } = resolveTax(item);

  const finalBase = Math.max(0, basePrice - discount);
  const taxAmount = (finalBase * taxPercentage) / 100;

  return {
    isAvailable,
    appliedPricingRule,
    basePrice: require('../utils/decimal').roundTo2(basePrice),
    discount: require('../utils/decimal').roundTo2(discount),
    taxPercentage: require('../utils/decimal').roundTo2(taxPercentage),
    taxAmount: require('../utils/decimal').roundTo2(taxAmount),
    grandTotal: require('../utils/decimal').roundTo2(finalBase + taxAmount)
  };
};