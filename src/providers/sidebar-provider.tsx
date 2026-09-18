'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from 'react';

interface SidebarContextValue {
  isCollapsed: boolean;
  isMobileOpen: boolean;
  toggleCollapsed: () => void;
  setMobileOpen: (open: boolean) => void;
}

const SidebarContext = createContext<SidebarContextValue | undefined>(undefined);

const SIDEBAR_COLLAPSED_KEY = 'sidebar-collapsed';
const MOBILE_BREAKPOINT = 1024;

// Read collapsed preference from localStorage without triggering cascading renders
function getCollapsedSnapshot(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
  } catch {
    return false;
  }
}

function getCollapsedServerSnapshot(): boolean {
  return false;
}

// We use a simple pub/sub to notify React when localStorage changes
let collapsedListeners: Array<() => void> = [];
function subscribeCollapsed(callback: () => void) {
  collapsedListeners.push(callback);
  return () => {
    collapsedListeners = collapsedListeners.filter((l) => l !== callback);
  };
}
function notifyCollapsedChange() {
  collapsedListeners.forEach((l) => l());
}

// Mobile open state — client-only, no persistence needed
let mobileOpenState = false;
let mobileListeners: Array<() => void> = [];
function subscribeMobile(callback: () => void) {
  mobileListeners.push(callback);
  return () => {
    mobileListeners = mobileListeners.filter((l) => l !== callback);
  };
}
function getMobileSnapshot(): boolean {
  return mobileOpenState;
}
function getMobileServerSnapshot(): boolean {
  return false;
}
function notifyMobileChange() {
  mobileListeners.forEach((l) => l());
}

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const isCollapsed = useSyncExternalStore(
    subscribeCollapsed,
    getCollapsedSnapshot,
    getCollapsedServerSnapshot
  );

  const isMobileOpen = useSyncExternalStore(
    subscribeMobile,
    getMobileSnapshot,
    getMobileServerSnapshot
  );

  // Close mobile sidebar on resize to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= MOBILE_BREAKPOINT && mobileOpenState) {
        mobileOpenState = false;
        notifyMobileChange();
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleCollapsed = useCallback(() => {
    const next = !getCollapsedSnapshot();
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
    notifyCollapsedChange();
  }, []);

  const setMobileOpen = useCallback((open: boolean) => {
    mobileOpenState = open;
    notifyMobileChange();
  }, []);

  const value = useMemo(
    () => ({ isCollapsed, isMobileOpen, toggleCollapsed, setMobileOpen }),
    [isCollapsed, isMobileOpen, toggleCollapsed, setMobileOpen]
  );

  return (
    <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (context === undefined) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
}
