'use server';

import { getCurrentUser } from '@/lib/auth/guards';
import {
  addToCustomerWishlist,
  getCustomerWishlist,
  getCustomerWishlistIds,
  getGuestWishlistItems,
  mergeGuestWishlist,
  removeFromCustomerWishlist,
  type WishlistItemData,
} from './wishlist-service';
import { revalidatePath } from 'next/cache';

/**
 * Retrieves wishlist items for the authenticated user, or empty if unauthenticated.
 */
export async function getWishlistItemsAction(
  branchSlug?: string | null
): Promise<{ success: boolean; items: WishlistItemData[]; isAuthenticated: boolean; error?: string }> {
  const user = await getCurrentUser();

  if (!user) {
    return { success: true, items: [], isAuthenticated: false };
  }

  try {
    const items = await getCustomerWishlist(user.id, branchSlug);
    return { success: true, items, isAuthenticated: true };
  } catch (error) {
    console.error('getWishlistItemsAction error:', error);
    return { success: false, items: [], isAuthenticated: true, error: 'Failed to load wishlist.' };
  }
}

/**
 * Retrieves the set of menu item IDs in the user's wishlist for fast heart icon checks.
 */
export async function getWishlistIdsAction(): Promise<{
  success: boolean;
  ids: string[];
  isAuthenticated: boolean;
}> {
  const user = await getCurrentUser();

  if (!user) {
    return { success: true, ids: [], isAuthenticated: false };
  }

  try {
    const ids = await getCustomerWishlistIds(user.id);
    return { success: true, ids, isAuthenticated: true };
  } catch (error) {
    console.error('getWishlistIdsAction error:', error);
    return { success: false, ids: [], isAuthenticated: true };
  }
}

/**
 * Toggles an item in the customer's wishlist.
 * If authenticated, updates the DB.
 * If unauthenticated, reports isAuthenticated: false so the client can manage in localStorage.
 */
export async function toggleWishlistAction(
  menuItemId: string
): Promise<{ success: boolean; inWishlist: boolean; isAuthenticated: boolean; error?: string }> {
  const user = await getCurrentUser();

  if (!user) {
    return { success: true, inWishlist: false, isAuthenticated: false };
  }

  try {
    const currentIds = await getCustomerWishlistIds(user.id);
    const isCurrentlyIn = currentIds.includes(menuItemId);

    if (isCurrentlyIn) {
      const res = await removeFromCustomerWishlist(user.id, menuItemId);
      if (!res.success) {
        return { success: false, inWishlist: true, isAuthenticated: true, error: res.error };
      }
      revalidatePath('/account/wishlist');
      return { success: true, inWishlist: false, isAuthenticated: true };
    } else {
      const res = await addToCustomerWishlist(user.id, menuItemId);
      if (!res.success) {
        return { success: false, inWishlist: false, isAuthenticated: true, error: res.error };
      }
      revalidatePath('/account/wishlist');
      return { success: true, inWishlist: true, isAuthenticated: true };
    }
  } catch (error) {
    console.error('toggleWishlistAction error:', error);
    return { success: false, inWishlist: false, isAuthenticated: true, error: 'Failed to update wishlist.' };
  }
}

/**
 * Merges guest wishlist items into the user's persistent DB wishlist after login.
 */
export async function mergeGuestWishlistAction(
  menuItemIds: string[]
): Promise<{ success: boolean; mergedCount: number; currentIds: string[] }> {
  const user = await getCurrentUser();

  if (!user) {
    return { success: false, mergedCount: 0, currentIds: [] };
  }

  const res = await mergeGuestWishlist(user.id, menuItemIds);
  revalidatePath('/account/wishlist');
  return res;
}

/**
 * Hydrates guest wishlist item cards for users who are browsing without an account.
 */
export async function getGuestWishlistItemsAction(
  menuItemIds: string[],
  branchSlug?: string | null
): Promise<{ success: boolean; items: WishlistItemData[] }> {
  try {
    const items = await getGuestWishlistItems(menuItemIds, branchSlug);
    return { success: true, items };
  } catch (error) {
    console.error('getGuestWishlistItemsAction error:', error);
    return { success: false, items: [] };
  }
}
