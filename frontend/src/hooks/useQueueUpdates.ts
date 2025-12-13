/**
 * useQueueUpdates - Auto-refresh queue data with polling
 * Manages real-time queue updates and predictions
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getCurrentQueue, getQueuePrediction } from '../api/queueApi';

interface QueueData {
  counters: Array<{
    id: string;
    name: string;
    queueLength: number;
    type: string;
    lastUpdate: string;
  }>;
  totalQueue: number;
  timestamp: string;
}

interface UseQueueUpdatesOptions {
  refreshInterval?: number; // In milliseconds (default: 5000ms = 5s)
  enabled?: boolean; // Whether polling is enabled
  onUpdate?: (data: QueueData) => void;
  onError?: (error: Error) => void;
}

interface UseQueueUpdatesReturn {
  queueData: QueueData | null;
  loading: boolean;
  error: Error | null;
  refreshNow: () => Promise<void>;
  startPolling: () => void;
  stopPolling: () => void;
  isPolling: boolean;
}

/**
 * Hook for auto-refreshing queue data
 * 
 * @param options - Configuration options
 * @returns Queue data with auto-refresh capabilities
 * 
 * @example
 * const { queueData, loading, refreshNow, isPolling } = useQueueUpdates({
 *   refreshInterval: 5000,
 *   enabled: true
 * });
 */
export function useQueueUpdates(
  options: UseQueueUpdatesOptions = {}
): UseQueueUpdatesReturn {
  const {
    refreshInterval = 5000, // Default: 5 seconds
    enabled = true,
    onUpdate,
    onError,
  } = options;

  const [queueData, setQueueData] = useState<QueueData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [isPolling, setIsPolling] = useState<boolean>(enabled);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef<boolean>(true);

  // Fetch queue data
  const fetchQueueData = useCallback(async () => {
    if (!isMountedRef.current) return;

    setLoading(true);
    setError(null);

    try {
      const data = await getCurrentQueue();
      
      if (isMountedRef.current) {
        setQueueData(data);
        onUpdate?.(data);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch queue data');
      
      if (isMountedRef.current) {
        setError(error);
        onError?.(error);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [onUpdate, onError]);

  // Start polling
  const startPolling = useCallback(() => {
    setIsPolling(true);
  }, []);

  // Stop polling
  const stopPolling = useCallback(() => {
    setIsPolling(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Manual refresh
  const refreshNow = useCallback(async () => {
    await fetchQueueData();
  }, [fetchQueueData]);

  // Setup polling interval
  useEffect(() => {
    if (isPolling && enabled) {
      // Fetch immediately
      fetchQueueData();

      // Setup interval
      intervalRef.current = setInterval(() => {
        fetchQueueData();
      }, refreshInterval);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    }
  }, [isPolling, enabled, refreshInterval, fetchQueueData]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    queueData,
    loading,
    error,
    refreshNow,
    startPolling,
    stopPolling,
    isPolling,
  };
}

/**
 * Hook for queue predictions with historical data
 * Fetches prediction based on last 60 queue values
 * 
 * @example
 * const { prediction, loading, getPrediction } = useQueuePrediction();
 * 
 * const handlePredict = async () => {
 *   await getPrediction(last60Values);
 * };
 */
export function useQueuePrediction() {
  const [prediction, setPrediction] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const getPrediction = useCallback(async (last60Values: number[]) => {
    if (last60Values.length !== 60) {
      setError(new Error('Exactly 60 values required for prediction'));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await getQueuePrediction(undefined, 15);
      setPrediction(result.predicted_queue);
      return result.predicted_queue;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to get prediction');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setPrediction(null);
    setError(null);
    setLoading(false);
  }, []);

  return {
    prediction,
    loading,
    error,
    getPrediction,
    reset,
  };
}

/**
 * Hook for combined queue updates with prediction
 * Auto-refreshes queue data and provides prediction capability
 * 
 * @example
 * const {
 *   queueData,
 *   prediction,
 *   loading,
 *   refreshNow,
 *   predictNext
 * } = useQueueWithPrediction({ refreshInterval: 10000 });
 */
export function useQueueWithPrediction(options: UseQueueUpdatesOptions = {}) {
  const queueUpdates = useQueueUpdates(options);
  const queuePrediction = useQueuePrediction();

  const predictNext = useCallback(
    async (last60Values: number[]) => {
      return await queuePrediction.getPrediction(last60Values);
    },
    [queuePrediction]
  );

  return {
    // Queue data
    queueData: queueUpdates.queueData,
    loading: queueUpdates.loading || queuePrediction.loading,
    error: queueUpdates.error || queuePrediction.error,
    
    // Queue operations
    refreshNow: queueUpdates.refreshNow,
    startPolling: queueUpdates.startPolling,
    stopPolling: queueUpdates.stopPolling,
    isPolling: queueUpdates.isPolling,
    
    // Prediction
    prediction: queuePrediction.prediction,
    predictNext,
    resetPrediction: queuePrediction.reset,
  };
}
