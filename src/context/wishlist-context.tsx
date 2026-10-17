'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  getWishlistIdsAction,
  mergeGuestWishlistAction,
  toggleWishlistAction,
} from '@/lib/customer/wishlist-actions';

interface WishlistContextType {
  wishlistIds: Set<string>;
  wishlistCount: number;
  isLoading: boolean;
  isAuthenticated: boolean;
  isInWishlist: (id: string) => boolean;
  toggleWishlist: (id: string) => Promise<boolean>;
  refreshWishlist: () => Promise<void>;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

const GUEST_WISHLIST_KEY = 'ox_guest_wishlist_v1';

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const pendingTogglesRef = useRef<Set<string>>(new Set());

  // Load wishlist on mount
  const refreshWishlist = useCallback(async () => {
    try {
      const serverRes = await getWishlistIdsAction();

      if (serverRes.isAuthenticated) {
        setIsAuthenticated(true);
        let currentSet = new Set(serverRes.ids);

        // Check if there are temporary guest wishlist items to merge
        try {
          const guestSaved = localStorage.getItem(GUEST_WISHLIST_KEY);
          if (guestSaved) {
            const guestIds: string[] = JSON.parse(guestSaved);
            if (Array.isArray(guestIds) && guestIds.length > 0) {
              const mergeRes = await mergeGuestWishlistAction(guestIds);
              if (mergeRes.success) {
                currentSet = new Set(mergeRes.currentIds);
                localStorage.removeItem(GUEST_WISHLIST_KEY);
              }
            }
          }
        } catch (e) {
          console.warn('Error reading or merging guest wishlist:', e);
        }

        setWishlistIds(currentSet);
      } else {
        // Guest mode: read from localStorage
        setIsAuthenticated(false);
        try {
          const guestSaved = localStorage.getItem(GUEST_WISHLIST_KEY);
          if (guestSaved) {
            const parsed = JSON.parse(guestSaved);
            if (Array.isArray(parsed)) {
              setWishlistIds(new Set(parsed));
            }
          }
        } catch (e) {
          console.warn('Error parsing guest wishlist from localStorage:', e);
        }
      }
    } catch (e) {
      console.error('Failed to initialize wishlist context:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      if (active) {
        await refreshWishlist();
      }
    })();
    return () => {
      active = false;
    };
  }, [refreshWishlist]);

  const isInWishlist = useCallback(
    (id: string) => {
      return wishlistIds.has(id);
    },
    [wishlistIds]
  );

  const toggleWishlist = useCallback(
    async (id: string): Promise<boolean> => {
      // Prevent rapid repeated clicks on the exact same item
      if (pendingTogglesRef.current.has(id)) {
        return wishlistIds.has(id);
      }

      pendingTogglesRef.current.add(id);

      const currentlyIn = wishlistIds.has(id);
      const nextIn = !currentlyIn;

      // 1. Optimistic UI update immediately
      setWishlistIds((prev) => {
        const next = new Set(prev);
        if (nextIn) {
          next.add(id);
        } else {
          next.delete(id);
        }
        return next;
      });

      try {
        if (isAuthenticated) {
          // Authenticated: mutate server DB
          const result = await toggleWishlistAction(id);
          if (!result.success) {
            // Revert on server error
            setWishlistIds((prev) => {
              const reverted = new Set(prev);
              if (currentlyIn) {
                reverted.add(id);
              } else {
                reverted.delete(id);
              }
              return reverted;
            });
            return currentlyIn;
          }
          return result.inWishlist;
        } else {
          // Guest: mutate localStorage
          try {
            const guestSaved = localStorage.getItem(GUEST_WISHLIST_KEY);
            let guestList: string[] = [];
            if (guestSaved) {
              const parsed = JSON.parse(guestSaved);
              if (Array.isArray(parsed)) guestList = parsed;
            }

            if (nextIn) {
              if (!guestList.includes(id)) guestList.push(id);
            } else {
              guestList = guestList.filter((item) => item !== id);
            }

            localStorage.setItem(GUEST_WISHLIST_KEY, JSON.stringify(guestList));
          } catch (e) {
            console.warn('Failed to save to localStorage:', e);
          }
          return nextIn;
        }
      } catch (err) {
        console.error('Error toggling wishlist:', err);
        // Revert on exception
        setWishlistIds((prev) => {
          const reverted = new Set(prev);
          if (currentlyIn) {
            reverted.add(id);
          } else {
            reverted.delete(id);
          }
          return reverted;
        });
        return currentlyIn;
      } finally {
        pendingTogglesRef.current.delete(id);
      }
    },
    [wishlistIds, isAuthenticated]
  );

  const value = useMemo(
    () => ({
      wishlistIds,
      wishlistCount: wishlistIds.size,
      isLoading,
      isAuthenticated,
      isInWishlist,
      toggleWishlist,
      refreshWishlist,
    }),
    [wishlistIds, isLoading, isAuthenticated, isInWishlist, toggleWishlist, refreshWishlist]
  );

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error('useWishlist must be used within a WishlistProvider');
  }
  return context;
}
