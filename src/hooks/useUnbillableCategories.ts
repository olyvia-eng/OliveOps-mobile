import { useCallback } from 'react';
import { loadActiveUnbillableCategories } from '@/api/clockingApi';
import { useAuthStore } from '@/store/authStore';
import { useClockingStore } from '@/store/clockingStore';

const CATEGORY_CACHE_TTL_MS = 5 * 60 * 1000;

export function useUnbillableCategories() {
  const { accessToken, user } = useAuthStore();
  const {
    unbillableCategories,
    unbillableCategoriesBusinessId,
    unbillableCategoriesError,
    unbillableCategoriesLoadedAt,
    unbillableCategoriesLoading,
    resetUnbillableCategories,
    setUnbillableCategories,
    setUnbillableCategoriesError,
    setUnbillableCategoriesLoading,
  } = useClockingStore();

  const businessId = user?.businessId ?? null;

  const loadIfNeeded = useCallback(async (force = false) => {
    if (!businessId) return;

    if (unbillableCategoriesBusinessId && unbillableCategoriesBusinessId !== businessId) {
      resetUnbillableCategories();
    }

    const cacheAgeMs = unbillableCategoriesLoadedAt ? Date.now() - unbillableCategoriesLoadedAt : Number.POSITIVE_INFINITY;
    const cacheIsFresh = cacheAgeMs < CATEGORY_CACHE_TTL_MS;

    if (!force && unbillableCategoriesBusinessId === businessId && cacheIsFresh) {
      return;
    }

    if (unbillableCategoriesLoading) {
      return;
    }

    setUnbillableCategoriesLoading(true);
    setUnbillableCategoriesError(null);
    try {
      const result = await loadActiveUnbillableCategories(accessToken);
      const activeItems = (result.items ?? [])
        .filter((item) => item.active === true)
        .slice()
        .sort((a, b) => {
          if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
          return a.name.localeCompare(b.name);
        });
      setUnbillableCategories(activeItems, businessId);
    } catch (error) {
      setUnbillableCategoriesError(
        error instanceof Error
          ? error.message
          : 'Could not load unbillable categories. Please try again.',
      );
    } finally {
      setUnbillableCategoriesLoading(false);
    }
  }, [
    accessToken,
    businessId,
    resetUnbillableCategories,
    setUnbillableCategories,
    setUnbillableCategoriesError,
    setUnbillableCategoriesLoading,
    unbillableCategoriesBusinessId,
    unbillableCategoriesLoadedAt,
    unbillableCategoriesLoading,
  ]);

  const retry = useCallback(async () => {
    await loadIfNeeded(true);
  }, [loadIfNeeded]);

  return {
    categories: unbillableCategories,
    loading: unbillableCategoriesLoading,
    error: unbillableCategoriesError,
    hasLoaded: Boolean(unbillableCategoriesLoadedAt),
    loadIfNeeded,
    retry,
  };
}
