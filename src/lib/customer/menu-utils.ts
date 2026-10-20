/**
 * Browser-safe Customer Menu Utilities & Types
 *
 * This module is safe to import into both Client Components and Server Components.
 * It contains NO database or server dependencies.
 */

export interface PublicMenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  originalPrice?: number;
  imageUrl: string | null;
  categoryId: string;
  categoryName: string;
  isAvailable: boolean;
  prepTimeMinutes: number;
}

export interface PublicMenuCategory {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  items: PublicMenuItem[];
}

export interface BranchMenuData {
  branch: {
    id: string;
    name: string;
    slug: string;
    address: string;
    city: string;
    isOpenNow: boolean;
    openingTime: string | null;
    closingTime: string | null;
    phone: string | null;
  };
  categories: PublicMenuCategory[];
}

export const NON_VEG_KEYWORDS = [
  'pepperoni',
  'chicken',
  'beef',
  'meat',
  'pork',
  'bacon',
  'fish',
  'mutton',
  'prawn',
  'seafood',
  'ham',
  'egg',
  'turkey',
  'salami',
  'lamb',
  'sausage',
  'wings',
  'patty',
  'smash',
];

/**
 * Pure heuristic function to classify if a menu item is vegetarian.
 * Safe for client-side evaluation.
 */
export function isItemVeg(item: { name: string; description?: string | null }): boolean {
  const text = `${item.name} ${item.description || ''}`.toLowerCase();

  // Explicit veg keywords take precedence
  if (
    text.includes('veggie') ||
    text.includes('pure veg') ||
    text.includes('paneer') ||
    text.includes('margherita') ||
    text.includes('makhani veg') ||
    text.includes('mushroom')
  ) {
    return true;
  }

  return !NON_VEG_KEYWORDS.some((kw) => text.includes(kw));
}

// High-quality, verified local images mapping directly to real menu items
export const ITEM_SPECIFIC_IMAGE_MAP: Record<string, string> = {
  'margherita pizza': '/images/hero-pizza.jpg',
  'pepperoni feast pizza': '/images/pepperoni-pizza.jpg',
  'classic cheeseburger': '/images/classic-cheeseburger.jpg',
  'crispy french fries': '/images/crispy-french-fries.jpg',
  'caffe latte': '/images/caffe-latte.jpg',
  'warm fudge brownie with ice cream': '/images/fudge-brownie.jpg',
  'garlic bread': '/images/garlic-breads.jpg',
};

export const CATEGORY_IMAGE_MAP: Record<string, string> = {
  pizzas: '/images/hero-pizza.jpg',
  pizza: '/images/hero-pizza.jpg',
  breads: '/images/garlic-breads.jpg',
  bread: '/images/garlic-breads.jpg',
  burgers: '/images/classic-cheeseburger.jpg',
  burger: '/images/classic-cheeseburger.jpg',
  'sides & appetizers': '/images/crispy-french-fries.jpg',
  sides: '/images/crispy-french-fries.jpg',
  beverages: '/images/caffe-latte.jpg',
  desserts: '/images/fudge-brownie.jpg',
};

export function getProductImage(
  itemName: string,
  categoryName: string,
  customImageUrl?: string | null
): string {
  if (customImageUrl && customImageUrl.trim().length > 0) return customImageUrl;
  const nameKey = itemName.toLowerCase().trim();
  if (ITEM_SPECIFIC_IMAGE_MAP[nameKey]) return ITEM_SPECIFIC_IMAGE_MAP[nameKey];

  for (const [key, img] of Object.entries(ITEM_SPECIFIC_IMAGE_MAP)) {
    if (nameKey.includes(key)) return img;
  }

  const catKey = categoryName.toLowerCase().trim();
  return CATEGORY_IMAGE_MAP[catKey] || '/images/hero-pizza.jpg';
}
