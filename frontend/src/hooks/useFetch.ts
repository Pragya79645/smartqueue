/**
 * useFetch - Generic API fetch hook
 * Manages loading, error, and data state for any API call
 */

import { useState, useEffect, useCallback } from 'react';

interface UseFetchOptions<T> {
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
  immediate?: boolean; // Whether to fetch immediately on mount
}

interface UseFetchReturn<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  reset: () => void;
}

/**
 * Generic fetch hook for API calls
 * 
 * @param fetchFn - Function that returns a Promise (API call)
 * @param options - Configuration options
 * @returns Object with data, loading, error states and refetch function
 * 
 * @example
 * const { data, loading, error, refetch } = useFetch(
 *   () => getCurrentQueue(),
 *   { immediate: true }
 * );
 */
export function useFetch<T>(
  fetchFn: () => Promise<T>,
  options: UseFetchOptions<T> = {}
): UseFetchReturn<T> {
  const { onSuccess, onError, immediate = false } = options;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const executeFetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await fetchFn();
      setData(result);
      onSuccess?.(result);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('An error occurred');
      setError(error);
      onError?.(error);
    } finally {
      setLoading(false);
    }
  }, [fetchFn, onSuccess, onError]);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  // Auto-fetch on mount if immediate is true
  useEffect(() => {
    if (immediate) {
      executeFetch();
    }
  }, [immediate, executeFetch]);

  return {
    data,
    loading,
    error,
    refetch: executeFetch,
    reset,
  };
}

/**
 * Hook for manual API calls (doesn't fetch on mount)
 * Useful for POST/PUT/DELETE operations
 * 
 * @example
 * const { execute, loading, error } = useManualFetch(
 *   (id) => deleteStaff(id)
 * );
 * 
 * const handleDelete = async () => {
 *   await execute('123');
 * };
 */
export function useManualFetch<T, Args extends any[]>(
  fetchFn: (...args: Args) => Promise<T>
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const execute = useCallback(
    async (...args: Args) => {
      setLoading(true);
      setError(null);

      try {
        const result = await fetchFn(...args);
        setData(result);
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('An error occurred');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [fetchFn]
  );

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return {
    data,
    loading,
    error,
    execute,
    reset,
  };
}
