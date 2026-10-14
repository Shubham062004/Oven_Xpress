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

// Fallback high-quality curated images for categories/items
const ITEM_IMAGE_MAP: Record<string, string> = {
  pizzas: '/images/hero-pizza.jpg',
  pizza: '/images/hero-pizza.jpg',
  breads: '/images/garlic-breads.jpg',
  bread: '/images/garlic-breads.jpg',
  burgers: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&auto=format&fit=crop&q=80',
  'sides & appetizers': '/images/garlic-breads.jpg',
  beverages: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=600&auto=format&fit=crop&q=80',
  desserts: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=600&auto=format&fit=crop&q=80',
};

export async function getPublicBranchMenu(branchSlug: string): Promise<BranchMenuData | null> {
  const branch = await getPublicBranchBySlug(branchSlug);
  if (!branch) return null;

  const categories = await prisma.menuCategory.findMany({
    where: { status: 'ACTIVE' },
    orderBy: { sortOrder: 'asc' },
    include: {
      items: {
        where: { status: 'ACTIVE' },
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

        const defaultCategoryImg =
          ITEM_IMAGE_MAP[category.name.toLowerCase()] || '/images/hero-pizza.jpg';

        return {
          id: item.id,
          name: item.name,
          description: item.description,
          price: finalPrice,
          originalPrice: finalPrice !== basePrice ? basePrice : undefined,
          imageUrl: item.imageUrl || defaultCategoryImg,
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
    where: { status: 'ACTIVE' },
    take: 6,
    include: {
      category: {
        select: { name: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return items.map((item) => {
    const defaultCategoryImg =
      ITEM_IMAGE_MAP[item.category.name.toLowerCase()] || '/images/hero-pizza.jpg';

    return {
      id: item.id,
      name: item.name,
      description: item.description,
      price: Number(item.price),
      imageUrl: item.imageUrl || defaultCategoryImg,
      categoryId: item.categoryId,
      categoryName: item.category.name,
      isAvailable: true,
      prepTimeMinutes: item.preparationTimeMinutes,
    };
  });
}
