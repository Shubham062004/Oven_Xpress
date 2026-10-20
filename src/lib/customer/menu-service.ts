import 'server-only';
import { prisma } from '@/lib/db/prisma';
import { getPublicBranchBySlug } from './branch-service';
import {
  type PublicMenuItem,
  type PublicMenuCategory,
  type BranchMenuData,
  NON_VEG_KEYWORDS,
  isItemVeg,
  getProductImage,
} from './menu-utils';

export type { PublicMenuItem, PublicMenuCategory, BranchMenuData };
export { NON_VEG_KEYWORDS, isItemVeg, getProductImage };

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
