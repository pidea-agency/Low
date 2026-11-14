import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface SidebarCollapseContextValue {
  isPinned: boolean;
  isHovered: boolean;
  isExpanded: boolean;
  togglePin: () => void;
  setPinned: (pinned: boolean) => void;
  setIsHovered: (hovered: boolean) => void;
  toggleCollapse: () => void;
}

const SidebarCollapseContext = createContext<SidebarCollapseContextValue | null>(null);

const PINNED_STORAGE_KEY = 'app_sidebar_pinned';

export function SidebarCollapseProvider({ children }: { children: React.ReactNode }) {
  const [isPinned, setIsPinnedState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    try {
      const stored = localStorage.getItem(PINNED_STORAGE_KEY);
      return stored !== null ? stored === 'true' : true;
    } catch {
      return true;
    }
  });

  const [isHovered, setIsHovered] = useState(false);

  const togglePin = useCallback(() => {
    setIsPinnedState((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(PINNED_STORAGE_KEY, String(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  }, []);

  const setPinned = useCallback((pinned: boolean) => {
    setIsPinnedState(pinned);
    try {
      localStorage.setItem(PINNED_STORAGE_KEY, String(pinned));
    } catch {
      // ignore storage errors
    }
  }, []);

  const toggleCollapse = useCallback(() => {
    togglePin();
  }, [togglePin]);

  const isExpanded = isPinned || isHovered;

  return (
    <SidebarCollapseContext.Provider
      value={{
        isPinned,
        isHovered,
        isExpanded,
        togglePin,
        setPinned,
        setIsHovered,
        toggleCollapse,
      }}
    >
      {children}
    </SidebarCollapseContext.Provider>
  );
}

export function useSidebarCollapse() {
  const context = useContext(SidebarCollapseContext);
  if (!context) {
    return {
      isPinned: true,
      isHovered: false,
      isExpanded: true,
      togglePin: () => {},
      setPinned: () => {},
      setIsHovered: () => {},
      toggleCollapse: () => {},
    };
  }
  return context;
}
