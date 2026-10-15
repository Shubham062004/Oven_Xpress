import { prisma } from '@/lib/db/prisma';
import { getPublicBranchBySlug } from './branch-service';

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

// High-quality, verified local images mapping directly to real menu items
const ITEM_SPECIFIC_IMAGE_MAP: Record<string, string> = {
  'margherita pizza': '/images/hero-pizza.jpg',
  'pepperoni feast pizza': '/images/pepperoni-pizza.jpg',
  'classic cheeseburger': '/images/classic-cheeseburger.jpg',
  'crispy french fries': '/images/crispy-french-fries.jpg',
  'caffe latte': '/images/caffe-latte.jpg',
  'warm fudge brownie with ice cream': '/images/fudge-brownie.jpg',
  'garlic bread': '/images/garlic-breads.jpg',
};

const CATEGORY_IMAGE_MAP: Record<string, string> = {
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

export async function getPublicBranchMenu(branchSlug: string): Promise<BranchMenuData | null> {
  const branch = await getPublicBranchBySlug(branchSlug);
  if (!branch) return null;

  const categories = await prisma.menuCategory.findMany({
    where: { status: 'ACTIVE' },
    orderBy: { sortOrder: 'asc' },
    include: {
      items: {
        where: {
          status: 'ACTIVE',
          NOT: [
            { name: { contains: 'E2E', mode: 'insensitive' } },
            { name: { contains: 'Test', mode: 'insensitive' } },
            { name: { contains: 'CA', mode: 'insensitive' } },
            { name: { contains: 'CB', mode: 'insensitive' } },
          ],
        },
        include: {
          branchAvailability: {
            where: { branchId: branch.id },
          },
        },
      },
    },
  });

  const formattedCategories: PublicMenuCategory[] = categories
    .map((category) => {
      const items: PublicMenuItem[] = category.items.map((item) => {
        const branchConfig = item.branchAvailability[0];
        const isAvailable = branchConfig ? branchConfig.isAvailable : true;
        const basePrice = Number(item.price);
        const finalPrice = branchConfig?.price
          ? Number(branchConfig.price)
          : basePrice;

        const imageUrl = getProductImage(item.name, category.name, item.imageUrl);

        return {
          id: item.id,
          name: item.name,
          description: item.description,
          price: finalPrice,
          originalPrice: finalPrice !== basePrice ? basePrice : undefined,
          imageUrl,
          categoryId: category.id,
          categoryName: category.name,
          isAvailable,
          prepTimeMinutes: item.preparationTimeMinutes,
        };
      });

      return {
        id: category.id,
        name: category.name,
        description: category.description,
        sortOrder: category.sortOrder,
        items,
      };
    })
    .filter((cat) => cat.items.length > 0);

  return {
    branch: {
      id: branch.id,
      name: branch.name,
      slug: branch.slug,
      address: branch.address,
      city: branch.city,
      isOpenNow: branch.isOpenNow,
      openingTime: branch.openingTime,
      closingTime: branch.closingTime,
      phone: branch.phone,
    },
    categories: formattedCategories,
  };
}

export async function getFeaturedMenuHighlights(): Promise<PublicMenuItem[]> {
  const items = await prisma.menuItem.findMany({
    where: {
      status: 'ACTIVE',
      NOT: [
        { name: { contains: 'E2E', mode: 'insensitive' } },
        { name: { contains: 'Test', mode: 'insensitive' } },
        { name: { contains: 'CA', mode: 'insensitive' } },
        { name: { contains: 'CB', mode: 'insensitive' } },
      ],
    },
    include: {
      category: {
        select: { name: true },
      },
    },
    orderBy: { createdAt: 'asc' },
    take: 6,
  });

  return items.map((item) => {
    const imageUrl = getProductImage(item.name, item.category.name, item.imageUrl);

    return {
      id: item.id,
      name: item.name,
      description: item.description,
      price: Number(item.price),
      imageUrl,
      categoryId: item.categoryId,
      categoryName: item.category.name,
      isAvailable: true,
      prepTimeMinutes: item.preparationTimeMinutes,
    };
  });
}
