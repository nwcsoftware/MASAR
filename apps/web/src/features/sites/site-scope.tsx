import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useCurrentUser } from '@/features/auth/session';

const STORAGE_KEY = 'masar.site';

interface SiteScope {
  /** null = all sites the user may see */
  siteId: string | null;
  setSiteId(siteId: string | null): void;
  /** user_sites scope; empty = unrestricted */
  allowedSiteIds: string[];
}

const SiteScopeContext = createContext<SiteScope | null>(null);

function readStored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/** SiteSwitcher state (docs/DESIGN.md §5). "All sites" is only offered to unscoped users. */
export function SiteScopeProvider({ children }: { children: ReactNode }) {
  const user = useCurrentUser();
  const allowedSiteIds = user.siteIds;
  const [stored, setStored] = useState<string | null>(readStored);

  const siteId = useMemo(() => {
    if (stored && (allowedSiteIds.length === 0 || allowedSiteIds.includes(stored))) return stored;
    return null;
  }, [stored, allowedSiteIds]);

  const setSiteId = useCallback((next: string | null) => {
    setStored(next);
    try {
      if (next) localStorage.setItem(STORAGE_KEY, next);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* storage blocked */
    }
  }, []);

  const value = useMemo(() => ({ siteId, setSiteId, allowedSiteIds }), [siteId, setSiteId, allowedSiteIds]);
  return <SiteScopeContext.Provider value={value}>{children}</SiteScopeContext.Provider>;
}

export function useSiteScope(): SiteScope {
  const scope = useContext(SiteScopeContext);
  if (!scope) throw new Error('useSiteScope must be used inside <SiteScopeProvider>');
  return scope;
}

/** Site ids to query: the selected site, else the user's scope (empty = all). */
export function useScopedSiteIds(): string[] {
  const { siteId, allowedSiteIds } = useSiteScope();
  return siteId ? [siteId] : allowedSiteIds;
}
