import { useMemo } from 'react';
import { useDrivers } from '@/features/drivers/queries';
import { companyDateKey } from '@/lib/format';
import { useDocumentTypes, useDriverDocuments, useJobTitles } from './queries';
import { driverDocumentItems, type DocumentItem } from './status';

/**
 * Every active driver's documents with their status (Documents page,
 * drivers list badges, the sidebar count). One place, one "today".
 */
export function useCompliance() {
  const drivers = useDrivers();
  const types = useDocumentTypes();
  const jobs = useJobTitles();
  const docs = useDriverDocuments();
  const queries = [drivers, types, jobs, docs];

  const items = useMemo<DocumentItem[]>(() => {
    if (!drivers.data || !types.data || !jobs.data || !docs.data) return [];
    const today = companyDateKey();
    return drivers.data
      .filter((d) => d.is_active)
      .flatMap((d) => driverDocumentItems(d, types.data, jobs.data.requirements, docs.data, today));
  }, [drivers.data, types.data, jobs.data, docs.data]);

  return {
    items,
    drivers: drivers.data ?? [],
    jobTitles: jobs.data?.titles ?? [],
    isPending: queries.some((q) => q.isPending),
    error: queries.find((q) => q.isError)?.error ?? null,
    refetch: () => queries.forEach((q) => void q.refetch()),
  };
}
