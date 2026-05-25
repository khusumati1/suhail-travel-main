// src/hooks/useFlightSearch.ts
import { useState, useCallback, useRef } from 'react';
import { apiService } from '../services/apiService';
import { FlightOffer } from '../types';

export interface SearchParams {
  origin: string;
  destination: string;
  departure_date: string;
  return_date?: string;
  passengers?: {
    adults: number;
    children: number;
    infants: number;
  };
  cabin_class?: string;
}

export function useFlightSearch() {
  const [offers, setOffers]     = useState<FlightOffer[]>([]);
  const [loading, setLoading]   = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError]       = useState<string | null>(null);
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const startProgressSimulation = (from: number, to: number, durationMs: number) => {
    if (progressTimer.current) clearInterval(progressTimer.current);
    const steps     = 20;
    const increment = (to - from) / steps;
    const interval  = durationMs / steps;
    let current     = from;
    progressTimer.current = setInterval(() => {
      current = Math.min(current + increment, to);
      setProgress(Math.round(current));
      if (current >= to && progressTimer.current) clearInterval(progressTimer.current);
    }, interval);
  };

  const searchFlights = useCallback(async (params: SearchParams) => {
    setLoading(true);
    setError(null);
    setOffers([]);
    setProgress(5);

    startProgressSimulation(5, 85, 5000);

    try {
      const data = await apiService.searchFlights(params);

      if (progressTimer.current) clearInterval(progressTimer.current);

      // ✅ Accept both real and mock flights (mock has isMock:true)
      if (data.flights && data.flights.length > 0) {
        setProgress(100);
        setOffers(data.flights);
      } else {
        // API returned success but zero flights — show friendly message
        setError('لا توجد رحلات متاحة لهذا المسار في التاريخ المحدد. يرجى تجربة تاريخ آخر.');
      }
    } catch (err: any) {
      console.warn('[useFlightSearch] Search failed:', err.message);
      if (progressTimer.current) clearInterval(progressTimer.current);
      setError('عذراً، فشل الاتصال بالخادم. يرجى المحاولة مرة أخرى.');
    } finally {
      setLoading(false);
      setProgress(100);
    }
  }, []);

  return { offers, loading, progress, error, searchFlights };
}
