// src/components/FlightFilters.tsx
import React, { useState, useMemo } from 'react';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Filter, Clock, Plane, RotateCcw, Check } from 'lucide-react';
import { FlightOffer } from '@/types';
import { cn } from '@/lib/utils';

export interface FlightFilterState {
  stops: number[];           // e.g. [0, 1, 2+]  — selected values
  maxPrice: number;
  timePeriods: string[];     // 'morning' | 'afternoon' | 'evening' | 'night'
  airlines: string[];        // selected IATA codes
}

interface FlightFiltersProps {
  offers: FlightOffer[];
  filters: FlightFilterState;
  onFilterChange: (filters: FlightFilterState) => void;
}

const TIME_PERIODS = [
  { id: 'morning',   label: 'صباحاً',  subtitle: '06:00 – 12:00', startH: 6,  endH: 12 },
  { id: 'afternoon', label: 'ظهراً',   subtitle: '12:00 – 18:00', startH: 12, endH: 18 },
  { id: 'evening',   label: 'مساءً',   subtitle: '18:00 – 00:00', startH: 18, endH: 24 },
  { id: 'night',     label: 'فجراً',   subtitle: '00:00 – 06:00', startH: 0,  endH: 6  },
];

const FlightFilters: React.FC<FlightFiltersProps> = ({ offers, filters, onFilterChange }) => {
  const [localPrice, setLocalPrice] = useState<number[]>([filters.maxPrice]);

  // --- Derived statistics from real offers ---
  const stats = useMemo(() => {
    if (!offers || offers.length === 0) return { minPrice: 0, maxPrice: 5000000, airlines: [], stopCounts: {} };

    const minPrice = Math.min(...offers.map(o => o.price));
    const maxPrice = Math.max(...offers.map(o => o.price));

    const airlineMap: Record<string, { code: string, name: string, count: number }> = {};
    const stopCounts: Record<number, number> = {};

    for (const offer of offers) {
      const code = offer.airlineCode || 'IA';
      if (!airlineMap[code]) airlineMap[code] = { code, name: offer.airline, count: 0 };
      airlineMap[code].count++;

      const stopBucket = offer.stops >= 2 ? 2 : offer.stops;
      stopCounts[stopBucket] = (stopCounts[stopBucket] || 0) + 1;
    }

    return { minPrice, maxPrice, airlines: Object.values(airlineMap), stopCounts };
  }, [offers]);

  const STOP_OPTIONS = [
    { value: 0, label: 'مباشر',          count: stats.stopCounts[0] || 0 },
    { value: 1, label: 'توقف واحد',     count: stats.stopCounts[1] || 0 },
    { value: 2, label: 'توقفان أو أكثر', count: stats.stopCounts[2] || 0 },
  ].filter(s => s.count > 0);

  const toggleStop = (val: number) => {
    const next = filters.stops.includes(val)
      ? filters.stops.filter(s => s !== val)
      : [...filters.stops, val];
    onFilterChange({ ...filters, stops: next });
  };

  const toggleAirline = (code: string) => {
    const next = filters.airlines.includes(code)
      ? filters.airlines.filter(a => a !== code)
      : [...filters.airlines, code];
    onFilterChange({ ...filters, airlines: next });
  };

  const toggleTimePeriod = (id: string) => {
    const next = filters.timePeriods.includes(id)
      ? filters.timePeriods.filter(t => t !== id)
      : [...filters.timePeriods, id];
    onFilterChange({ ...filters, timePeriods: next });
  };

  const handlePriceCommit = (val: number[]) => {
    onFilterChange({ ...filters, maxPrice: val[0] });
  };

  const resetAll = () => {
    const reset: FlightFilterState = {
      stops: [],
      maxPrice: stats.maxPrice,
      timePeriods: [],
      airlines: [],
    };
    setLocalPrice([stats.maxPrice]);
    onFilterChange(reset);
  };

  const hasActiveFilters =
    filters.stops.length > 0 ||
    filters.timePeriods.length > 0 ||
    filters.airlines.length > 0 ||
    filters.maxPrice < stats.maxPrice;

  return (
    <div className="space-y-7">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
            <Filter className="w-4 h-4 text-primary" />
          </div>
          <h2 className="text-base font-black tracking-tight">تصفية النتائج</h2>
        </div>
        {hasActiveFilters && (
          <button onClick={resetAll} className="flex items-center gap-1.5 text-[10px] font-black text-primary uppercase tracking-widest">
            <RotateCcw className="w-3 h-3" />
            إعادة ضبط
          </button>
        )}
      </div>

      {/* Stops */}
      {STOP_OPTIONS.length > 0 && (
        <>
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-primary">
              <Plane className="w-3.5 h-3.5" />
              <h3 className="text-[10px] font-black uppercase tracking-[0.15em]">عدد التوقفات</h3>
            </div>
            {STOP_OPTIONS.map(opt => {
              const active = filters.stops.includes(opt.value);
              return (
                <div
                  key={opt.value}
                  onClick={() => toggleStop(opt.value)}
                  className={cn(
                    'flex items-center justify-between p-3 rounded-2xl border cursor-pointer transition-all',
                    active ? 'border-primary/50 bg-primary/5' : 'border-border/40 hover:border-primary/20'
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <div className={cn(
                      'w-4 h-4 rounded-md border-2 flex items-center justify-center transition-all',
                      active ? 'border-primary bg-primary' : 'border-border/60'
                    )}>
                      {active && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                    </div>
                    <span className="text-sm font-bold">{opt.label}</span>
                  </div>
                  <span className="text-[10px] font-black bg-secondary px-2 py-0.5 rounded-lg text-muted-foreground">
                    {opt.count}
                  </span>
                </div>
              );
            })}
          </div>
          <Separator className="bg-border/30" />
        </>
      )}

      {/* Price Range */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-[10px] font-black uppercase tracking-[0.15em] text-primary">الحد الأقصى للسعر</h3>
          <span className="text-sm font-black text-primary tabular-nums">{localPrice[0].toLocaleString()} د.ع</span>
        </div>
        <Slider
          value={localPrice}
          min={stats.minPrice}
          max={stats.maxPrice}
          step={Math.ceil((stats.maxPrice - stats.minPrice) / 100)}
          onValueChange={(v) => setLocalPrice(v)}
          onValueCommit={handlePriceCommit}
          className="py-2"
        />
        <div className="flex justify-between text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
          <span>{stats.minPrice.toLocaleString()} د.ع</span>
          <span>{stats.maxPrice.toLocaleString()} د.ع</span>
        </div>
      </div>

      <Separator className="bg-border/30" />

      {/* Time of Departure */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-primary">
          <Clock className="w-3.5 h-3.5" />
          <h3 className="text-[10px] font-black uppercase tracking-[0.15em]">وقت الإقلاع</h3>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {TIME_PERIODS.map(period => {
            const active = filters.timePeriods.includes(period.id);
            return (
              <button
                key={period.id}
                onClick={() => toggleTimePeriod(period.id)}
                className={cn(
                  'p-3 rounded-2xl border transition-all text-right',
                  active
                    ? 'border-primary/50 bg-primary/8 shadow-sm shadow-primary/10'
                    : 'border-border/40 hover:border-primary/20'
                )}
              >
                <p className={cn('text-xs font-black transition-colors', active ? 'text-primary' : '')}>{period.label}</p>
                <p className="text-[9px] text-muted-foreground font-medium mt-0.5">{period.subtitle}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Airlines */}
      {stats.airlines.length > 1 && (
        <>
          <Separator className="bg-border/30" />
          <div className="space-y-3">
            <h3 className="text-[10px] font-black uppercase tracking-[0.15em] text-primary">شركة الطيران</h3>
            {stats.airlines.map(airline => {
              const active = filters.airlines.includes(airline.code);
              return (
                <div
                  key={airline.code}
                  onClick={() => toggleAirline(airline.code)}
                  className={cn(
                    'flex items-center justify-between p-3 rounded-2xl border cursor-pointer transition-all',
                    active ? 'border-primary/50 bg-primary/5' : 'border-border/40 hover:border-primary/20'
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <div className={cn(
                      'w-4 h-4 rounded-md border-2 flex items-center justify-center transition-all shrink-0',
                      active ? 'border-primary bg-primary' : 'border-border/60'
                    )}>
                      {active && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                    </div>
                    <img
                      src={`https://images.kiwi.com/airlines/64/${airline.code}.png`}
                      className="w-5 h-5 object-contain rounded-sm"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                    <span className="text-xs font-bold leading-tight">{airline.name}</span>
                  </div>
                  <span className="text-[10px] font-black bg-secondary px-2 py-0.5 rounded-lg text-muted-foreground shrink-0">
                    {airline.count}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default FlightFilters;
