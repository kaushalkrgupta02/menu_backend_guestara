export const isItemEffectivelyActive = (item: any): boolean => {
  const categoryActive = item?.category?.is_active ?? true;
  const subcategoryActive = item?.subcategory?.is_active ?? true;
  const itemActive = !!item?.is_active;

  return categoryActive && subcategoryActive && itemActive;
};
