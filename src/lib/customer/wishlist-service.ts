import { prisma } from '@/lib/db/prisma';
import { getProductImage } from './menu-service';

export interface WishlistItemData {
  id: string; // menuItemId
  wishlistEntryId: string;
  name: string;
  description: string | null;
  price: number;
  originalPrice?: number;
  imageUrl: string | null;
  categoryId: string;
  categoryName: string;
  isAvailable: boolean;
  prepTimeMinutes: number;
  createdAt: string;
}

/**
 * Fetches all wishlist items for a given user, applying branch pricing and availability
 * if a branchSlug is specified, or default pricing if not.
 */
export async function getCustomerWishlist(
  userId: string,
  branchSlug?: string | null
): Promise<WishlistItemData[]> {
  // Look up branch if slug provided
  let branchId: string | undefined;
  if (branchSlug) {
    const branch = await prisma.branch.findUnique({
      where: { slug: branchSlug },
      select: { id: true },
    });
    branchId = branch?.id;
  }

  const entries = await prisma.customerWishlist.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: {
      menuItem: {
        include: {
          category: {
            select: { id: true, name: true },
          },
          branchAvailability: branchId
            ? {
                where: { branchId },
              }
            : {
                take: 1,
              },
        },
      },
    },
  });

  return entries.map((entry) => {
    const item = entry.menuItem;
    const branchConfig = item.branchAvailability[0];
    const basePrice = Number(item.price);
    const finalPrice = branchConfig?.price ? Number(branchConfig.price) : basePrice;
    const isAvailable = item.status === 'ACTIVE' && (branchConfig ? branchConfig.isAvailable : true);
    const imageUrl = getProductImage(item.name, item.category?.name || 'Pizza', item.imageUrl);

    return {
      id: item.id,
      wishlistEntryId: entry.id,
      name: item.name,
      description: item.description,
      price: finalPrice,
      originalPrice: finalPrice !== basePrice ? basePrice : undefined,
      imageUrl,
      categoryId: item.categoryId,
      categoryName: item.category?.name || 'General',
      isAvailable,
      prepTimeMinutes: item.preparationTimeMinutes,
      createdAt: entry.createdAt.toISOString(),
    };
  });
}

/**
 * Retrieves the raw set of wishlist menuItemIds for an authenticated user.
 */
export async function getCustomerWishlistIds(userId: string): Promise<string[]> {
  const entries = await prisma.customerWishlist.findMany({
    where: { userId },
    select: { menuItemId: true },
  });
  return entries.map((e) => e.menuItemId);
}

/**
 * Adds an item to a customer's wishlist (idempotent).
 */
export async function addToCustomerWishlist(
  userId: string,
  menuItemId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const item = await prisma.menuItem.findUnique({
      where: { id: menuItemId },
      select: { id: true, status: true },
    });

    if (!item) {
      return { success: false, error: 'Product not found.' };
    }

    await prisma.customerWishlist.upsert({
      where: {
        userId_menuItemId: {
          userId,
          menuItemId,
        },
      },
      create: {
        userId,
        menuItemId,
      },
      update: {},
    });

    return { success: true };
  } catch (error) {
    console.error('Failed to add item to wishlist:', error);
    return { success: false, error: 'Could not add item to wishlist.' };
  }
}

/**
 * Removes an item from a customer's wishlist.
 */
export async function removeFromCustomerWishlist(
  userId: string,
  menuItemId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await prisma.customerWishlist.deleteMany({
      where: {
        userId,
        menuItemId,
      },
    });

    return { success: true };
  } catch (error) {
    console.error('Failed to remove item from wishlist:', error);
    return { success: false, error: 'Could not remove item from wishlist.' };
  }
}

/**
 * Merges guest wishlist items stored in browser into the user's persistent database wishlist.
 */
export async function mergeGuestWishlist(
  userId: string,
  menuItemIds: string[]
): Promise<{ success: boolean; mergedCount: number; currentIds: string[] }> {
  if (!menuItemIds || menuItemIds.length === 0) {
    const current = await getCustomerWishlistIds(userId);
    return { success: true, mergedCount: 0, currentIds: current };
  }

  try {
    // Validate that the items exist
    const validItems = await prisma.menuItem.findMany({
      where: {
        id: { in: menuItemIds },
        status: 'ACTIVE',
      },
      select: { id: true },
    });

    const validIds = validItems.map((i) => i.id);

    // Upsert each valid item
    await Promise.all(
      validIds.map((menuItemId) =>
        prisma.customerWishlist.upsert({
          where: {
            userId_menuItemId: {
              userId,
              menuItemId,
            },
          },
          create: {
            userId,
            menuItemId,
          },
          update: {},
        })
      )
    );

    const currentIds = await getCustomerWishlistIds(userId);
    return { success: true, mergedCount: validIds.length, currentIds };
  } catch (error) {
    console.error('Failed to merge guest wishlist:', error);
    const currentIds = await getCustomerWishlistIds(userId);
    return { success: false, mergedCount: 0, currentIds };
  }
}

/**
 * Hydrates wishlist item details for guest users without persisting to DB.
 */
export async function getGuestWishlistItems(
  menuItemIds: string[],
  branchSlug?: string | null
): Promise<WishlistItemData[]> {
  if (!menuItemIds || menuItemIds.length === 0) {
    return [];
  }

  let branchId: string | undefined;
  if (branchSlug) {
    const branch = await prisma.branch.findUnique({
      where: { slug: branchSlug },
      select: { id: true },
    });
    branchId = branch?.id;
  }

  const items = await prisma.menuItem.findMany({
    where: {
      id: { in: menuItemIds },
      status: 'ACTIVE',
    },
    include: {
      category: {
        select: { id: true, name: true },
      },
      branchAvailability: branchId
        ? {
            where: { branchId },
          }
        : {
            take: 1,
          },
    },
  });

  return items.map((item) => {
    const branchConfig = item.branchAvailability[0];
    const basePrice = Number(item.price);
    const finalPrice = branchConfig?.price ? Number(branchConfig.price) : basePrice;
    const isAvailable = item.status === 'ACTIVE' && (branchConfig ? branchConfig.isAvailable : true);
    const imageUrl = getProductImage(item.name, item.category?.name || 'Pizza', item.imageUrl);

    return {
      id: item.id,
      wishlistEntryId: `guest-${item.id}`,
      name: item.name,
      description: item.description,
      price: finalPrice,
      originalPrice: finalPrice !== basePrice ? basePrice : undefined,
      imageUrl,
      categoryId: item.categoryId,
      categoryName: item.category?.name || 'General',
      isAvailable,
      prepTimeMinutes: item.preparationTimeMinutes,
      createdAt: new Date().toISOString(),
    };
  });
}
