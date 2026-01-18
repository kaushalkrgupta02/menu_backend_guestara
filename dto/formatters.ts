/**
 * Centralized response formatters for all entities
 * Maps database fields to API response format (snake_case)
 */

const decimal = require('../utils/decimal');
const { formatTimestampToLocal } = require('../utils/time');

/**
 * Pricing type enum to display name mapping
 */
const PRICING_TYPE_MAP: Record<string, string> = {
  'A': 'STATIC',
  'B': 'TIERED',
  'C': 'COMPLIMENTARY',
  'D': 'DISCOUNTED',
  'E': 'DYNAMIC'
};

/**
 * Format Category entity for API response
 */
export const formatCategory = (category: any) => {
  return {
    id: category.id,
    name: category.name,
    description: category.description || null,
    image: category.image || null,
    tax_applicable: category.tax_applicable,
    tax_percentage: category.tax_percentage ? decimal.decimalToNumber(category.tax_percentage, 2) : null,
    is_active: category.is_active,
    created_at: category.createdAt ? formatTimestampToLocal(category.createdAt) : null,
    updated_at: category.updatedAt ? formatTimestampToLocal(category.updatedAt) : null
  };
};

/**
 * Format Subcategory entity for API response
 */
export const formatSubcategory = (subcategory: any) => {
  return {
    id: subcategory.id,
    category_id: subcategory.categoryId,
    name: subcategory.name,
    description: subcategory.description || null,
    image: subcategory.image || null,
    tax_applicable: subcategory.tax_applicable,
    tax_percentage: subcategory.tax_percentage ? decimal.decimalToNumber(subcategory.tax_percentage, 2) : null,
    is_active: subcategory.is_active,
    created_at: subcategory.createdAt ? formatTimestampToLocal(subcategory.createdAt) : null,
    updated_at: subcategory.updatedAt ? formatTimestampToLocal(subcategory.updatedAt) : null
  };
};

/**
 * Format Item entity for API response
 * Includes pricing config and tax settings
 */
export const formatItem = (item: any) => {
  return {
    id: item.id,
    category_id: item.categoryId || null,
    subcategory_id: item.subcategoryId || null,
    name: item.name,
    description: item.description || null,
    image: item.image || null,
    base_price: item.base_price ? decimal.decimalToNumber(item.base_price, 2) : 0,
    pricing_type: item.type_of_pricing ? PRICING_TYPE_MAP[item.type_of_pricing] : null,
    pricing_config: item.price_config || null,
    is_tax_inherit: item.is_tax_inherit,
    tax_applicable: item.tax_applicable,
    tax_percentage: item.tax_percentage ? decimal.decimalToNumber(item.tax_percentage, 2) : null,
    is_bookable: item.is_bookable,
    is_active: item.is_active,
    avl_days: item.avl_days || null,
    avl_times: item.avl_times || null,
    created_at: item.createdAt ? formatTimestampToLocal(item.createdAt) : null,
    updated_at: item.updatedAt ? formatTimestampToLocal(item.updatedAt) : null
  };
};

/**
 * Format Addon entity for API response
 */
export const formatAddon = (addon: any) => {
  return {
    id: addon.id,
    name: addon.name,
    description: addon.description || null,
    price: addon.price ? decimal.decimalToNumber(addon.price, 2) : 0,
    is_active: addon.is_active,
    created_at: addon.createdAt ? formatTimestampToLocal(addon.createdAt) : null,
    updated_at: addon.updatedAt ? formatTimestampToLocal(addon.updatedAt) : null
  };
};

/**
 * Format Booking entity for API response
 */
export const formatBooking = (booking: any) => {
  return {
    id: booking.id,
    user_id: booking.userId || null,
    item_id: booking.itemId,
    quantity: booking.quantity,
    booking_date: booking.bookingDate ? formatTimestampToLocal(booking.bookingDate) : null,
    status: booking.status,
    total_amount: booking.total_amount ? decimal.decimalToNumber(booking.total_amount, 2) : 0,
    notes: booking.notes || null,
    created_at: booking.createdAt ? formatTimestampToLocal(booking.createdAt) : null,
    updated_at: booking.updatedAt ? formatTimestampToLocal(booking.updatedAt) : null
  };
};

/**
 * Format paginated list response
 */
export const formatPaginatedResponse = (items: any[], page: number, limit: number, total: number, formatter: (item: any) => any) => {
  return {
    page,
    limit,
    total,
    total_pages: Math.ceil(total / limit),
    items: items.map(formatter)
  };
};

/**
 * Format single item response
 */
export const formatSingleResponse = (item: any, formatter: (item: any) => any) => {
  return formatter(item);
};
