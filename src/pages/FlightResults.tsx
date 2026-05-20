// src/pages/FlightResults.tsx
import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight, Loader2, Plane, AlertCircle,
  SlidersHorizontal, Pencil, RefreshCw
} from 'lucide-react';
import FlightSearchForm from '@/components/FlightSearchForm';
import FlightResultCard from '@/components/FlightResultCard';
import FlightFilters, { FlightFilterState } from '@/components/FlightFilters';
import { useFlightSearch } from '@/hooks/useFlightSearch';
import BottomNav from '@/components/BottomNav';
import { Progress } from '@/components/ui/progress';
import {
  Sheet, SheetContent, SheetTrigger,
  SheetHeader, SheetTitle
} from '@/components/ui/sheet';

// ─── Duration helper ───────────────────────────────────────────────────────────
const parseDurationToMinutes = (d: string): number => {
  if (!d) return 9999;
  const h = d.match(/(\d+)\s*h/);
  const m = d.match(/(\d+)\s*m/);
  let total = 0;
  if (h) total += parseInt(h[1]) * 60;
  if (m) total += parseInt(m[1]);
  if (!h && !m) { const raw = parseInt(d); if (!isNaN(raw)) total = raw; }
  return total || 9999;
};

const formatDurationAr = (d: string) => {
  const mins = parseDurationToMinutes(d);
  if (mins === 9999) return d;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h > 0 ? h + 'س ' : ''}${m > 0 ? m + 'د' : ''}` || 'مباشر';
};

// ─── Departure hour from time string ──────────────────────────────────────────
const getDepHour = (timeStr: string): number => {
  if (!timeStr) return -1;
  const parts = timeStr.trim().split(' ');
  const timePart = parts.length > 1 ? parts[1] : parts[0];
  return parseInt(timePart?.split(':')[0] ?? '-1');
};

// ─── Default filter state ─────────────────────────────────────────────────────
const buildDefaultFilters = (maxPrice: number): FlightFilterState => ({
  stops: [],
  maxPrice,
  timePeriods: [],
  airlines: [],
});

const FlightResults = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [showSearchForm, setShowSearchForm] = useState(false);
  const [activeTab, setActiveTab] = useState<'best' | 'cheapest' | 'fastest'>('cheapest');
  const [filters, setFilters] = useState<FlightFilterState>(buildDefaultFilters(99999999));

  const { offers, loading, progress, error, searchFlights } = useFlightSearch();

  const currentSearch = location.state as any;

  // Run search on load
  useEffect(() => {
    const s = location.state as any;
    if (s?.origin && s?.destination && s?.departure_date) {
      searchFlights({
        origin: s.origin,
        destination: s.destination,
        departure_date: s.departure_date,
        return_date: s.return_date,
        passengers: s.passengers || { adults: 1, children: 0, infants: 0 },
        cabin_class: s.cabin_class || 'economy',
      });
    }
  }, [location.state, searchFlights]);

  // Reset filters when new results arrive
  useEffect(() => {
    if (offers.length > 0) {
      const maxP = Math.max(...offers.map(o => o.price));
      setFilters(buildDefaultFilters(maxP));
    }
  }, [offers]);

  // ── Stats for tab headers ──────────────────────────────────────────────────
  const cheapestOffer = useMemo(() =>
    offers.length > 0 ? [...offers].sort((a, b) => a.price - b.price)[0] : null,
    [offers]);

  const fastestOffer = useMemo(() =>
    offers.length > 0 ? [...offers].sort((a, b) => parseDurationToMinutes(a.duration) - parseDurationToMinutes(b.duration))[0] : null,
    [offers]);

  const bestOffer = useMemo(() =>
    offers.length > 0
      ? [...offers].sort((a, b) =>
          (a.price + parseDurationToMinutes(a.duration) * 1000) -
          (b.price + parseDurationToMinutes(b.duration) * 1000)
        )[0]
      : null,
    [offers]);

  const cheapestPrice = cheapestOffer ? `${cheapestOffer.price.toLocaleString()} د.ع` : '--';
  const fastestDur   = fastestOffer  ? formatDurationAr(fastestOffer.duration)         : '--';
  const bestPrice    = bestOffer     ? `${bestOffer.price.toLocaleString()} د.ع`        : '--';

  // ── Apply filters + sort ───────────────────────────────────────────────────
  const filteredSortedOffers = useMemo(() => {
    let result = [...offers];

    // Stops filter
    if (filters.stops.length > 0) {
      result = result.filter(o => {
        const bucket = o.stops >= 2 ? 2 : o.stops;
        return filters.stops.includes(bucket);
      });
    }

    // Max price filter
    result = result.filter(o => o.price <= filters.maxPrice);

    // Time period filter
    if (filters.timePeriods.length > 0) {
      result = result.filter(o => {
        const h = getDepHour(o.departureTime);
        return filters.timePeriods.some(p => {
          if (p === 'morning')   return h >= 6  && h < 12;
          if (p === 'afternoon') return h >= 12 && h < 18;
          if (p === 'evening')   return h >= 18 && h < 24;
          if (p === 'night')     return h >= 0  && h < 6;
          return false;
        });
      });
    }

    // Airline filter
    if (filters.airlines.length > 0) {
      result = result.filter(o => filters.airlines.includes(o.airlineCode));
    }

    // Sorting
    result.sort((a, b) => {
      if (activeTab === 'cheapest') return a.price - b.price;
      if (activeTab === 'fastest')  return parseDurationToMinutes(a.duration) - parseDurationToMinutes(b.duration);
      // best
      return (a.price + parseDurationToMinutes(a.duration) * 500) -
             (b.price + parseDurationToMinutes(b.duration) * 500);
    });

    return result;
  }, [offers, filters, activeTab]);

  const handleFlightSelect = (flight: any) => {
    navigate('/flights/booking', { state: { flight } });
  };

  const handleRetry = () => {
    const s = location.state as any;
    if (s?.origin && s?.destination && s?.departure_date) {
      searchFlights({
        origin: s.origin,
        destination: s.destination,
        departure_date: s.departure_date,
        return_date: s.return_date,
        passengers: s.passengers || { adults: 1, children: 0, infants: 0 },
        cabin_class: s.cabin_class || 'economy',
      });
    }
  };

  const TABS = [
    { id: 'cheapest', label: 'الأرخص',  value: cheapestPrice, subtitle: 'سعر منافس'     },
    { id: 'best',     label: 'الأفضل',  value: bestPrice,     subtitle: 'رحلة متوازنة'  },
    { id: 'fastest',  label: 'الأسرع',  value: fastestDur,    subtitle: 'أقل وقت سفر'  },
  ];

  return (
    <div className="min-h-screen bg-secondary/30 pb-40" dir="rtl">

      {/* ─── Sticky Header ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b border-border/40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          <button
            onClick={() => navigate('/home')}
            className="w-10 h-10 flex items-center justify-center text-foreground hover:bg-secondary/80 rounded-full"
          >
            <ArrowRight className="w-5 h-5" />
          </button>

          {/* Compact search summary */}
          <div
            onClick={() => setShowSearchForm(!showSearchForm)}
            className="flex-1 flex items-center justify-center gap-2 bg-secondary/50 rounded-2xl py-2 px-4 border border-border/10 cursor-pointer active:scale-95 transition-transform"
          >
            <p className="text-[11px] font-black tracking-tight leading-none">
              {currentSearch?.origin} ✈️ {currentSearch?.destination}
              <span className="mx-2 text-muted-foreground/40">|</span>
              {currentSearch?.departure_date?.split('-')?.slice(1)?.join('/')}
              <span className="mx-2 text-muted-foreground/40">|</span>
              {currentSearch?.passengers?.adults || 1} مسافر
            </p>
            <Pencil className="w-3 h-3 text-primary" />
          </div>

          <div className="w-10" />
        </div>

        {/* Collapsible search form */}
        <AnimatePresence>
          {showSearchForm && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-16 left-0 w-full bg-background border-b border-border shadow-2xl p-4 z-50"
            >
              <FlightSearchForm
                onSearch={(params) => { searchFlights(params); setShowSearchForm(false); }}
                isLoading={loading}
              />
              <button
                onClick={() => setShowSearchForm(false)}
                className="w-full py-3 text-[11px] font-black text-muted-foreground uppercase tracking-widest"
              >
                إغلاق
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ─── Main Content ──────────────────────────────────────────────────── */}
      <main className="max-w-xl mx-auto px-4 pt-6">

        {/* Loading */}
        <AnimatePresence>
          {loading && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="space-y-4 mb-6"
            >
              <div className="bg-primary/5 rounded-[24px] p-5 border border-primary/10">
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 text-primary animate-spin" />
                    <span className="text-[11px] font-black">
                      {progress < 65 ? 'جاري البحث عن الرحلات...' : 'جاري معالجة النتائج...'}
                    </span>
                  </div>
                  <span className="text-sm font-black text-primary">{progress}%</span>
                </div>
                <Progress value={progress} className="h-1.5" />
                <p className="text-[9px] text-muted-foreground font-medium mt-2 text-center">
                  يتم جلب البيانات باحترافية وتحديث الأسعار
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error */}
        <AnimatePresence>
          {error && !loading && (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="bg-destructive/5 border border-destructive/10 rounded-[28px] p-8 text-center mb-6"
            >
              <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-7 h-7 text-destructive" />
              </div>
              <h3 className="text-base font-black text-foreground mb-2">لا توجد رحلات متاحة</h3>
              <p className="text-sm text-muted-foreground mb-6 leading-relaxed">{error}</p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={handleRetry}
                  className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-xs font-black shadow-lg shadow-primary/20 active:scale-95 transition-all"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  إعادة المحاولة
                </button>
                <button
                  onClick={() => setShowSearchForm(true)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-secondary text-foreground rounded-xl text-xs font-black active:scale-95 transition-all"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  تعديل البحث
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sorting Tabs */}
        {offers.length > 0 && !loading && (
          <div className="grid grid-cols-3 gap-2 mb-4 bg-card border border-border/40 p-1.5 rounded-[24px] shadow-sm">
            {TABS.map(tab => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex flex-col items-center justify-center py-3.5 px-2 rounded-[18px] transition-all relative overflow-hidden ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-md shadow-primary/10'
                      : 'hover:bg-secondary/50 text-foreground'
                  }`}
                >
                  <span className={`text-[10px] font-black tracking-tight ${isActive ? 'text-primary-foreground/90' : 'text-muted-foreground'}`}>
                    {tab.label}
                  </span>
                  <span className="text-[13px] font-black tracking-tighter mt-1 tabular-nums">
                    {tab.value}
                  </span>
                  <span className={`text-[9px] font-bold mt-0.5 opacity-60 ${isActive ? 'text-primary-foreground/75' : 'text-muted-foreground'}`}>
                    {tab.subtitle}
                  </span>
                  {isActive && (
                    <motion.div
                      layoutId="activeTabIndicator"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/40 rounded-t-full"
                    />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Results count badge */}
        {filteredSortedOffers.length > 0 && !loading && (
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-black text-muted-foreground">
              {filteredSortedOffers.length} رحلة متاحة
            </p>
            {filteredSortedOffers.length < offers.length && (
              <p className="text-[10px] font-bold text-primary">
                (مُصفّى من {offers.length})
              </p>
            )}
          </div>
        )}

        {/* Flight Cards */}
        <div className="space-y-2">
          {filteredSortedOffers.length > 0 ? (
            filteredSortedOffers.map((flight, index) => (
              <FlightResultCard
                key={flight.id || index}
                flight={flight}
                index={index}
                onClick={() => handleFlightSelect(flight)}
              />
            ))
          ) : (
            !loading && !error && offers.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="py-16 text-center"
              >
                <div className="w-16 h-16 rounded-full bg-secondary/80 flex items-center justify-center mx-auto mb-4 opacity-50">
                  <Plane className="w-8 h-8" />
                </div>
                <p className="text-sm font-black opacity-50 mb-2">لا توجد رحلات مطابقة للتصفية</p>
                <button
                  onClick={() => {
                    const maxP = Math.max(...offers.map(o => o.price));
                    setFilters(buildDefaultFilters(maxP));
                  }}
                  className="text-xs font-black text-primary underline underline-offset-4"
                >
                  إزالة كل الفلاتر
                </button>
              </motion.div>
            )
          )}

          {!loading && !error && offers.length === 0 && (
            <div className="py-20 text-center opacity-40">
              <Plane className="w-12 h-12 mx-auto mb-4" />
              <p className="text-sm font-black">لا توجد رحلات متاحة</p>
            </div>
          )}
        </div>
      </main>

      {/* ─── Floating Filter Button ────────────────────────────────────────── */}
      {offers.length > 0 && !loading && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40">
          <Sheet>
            <SheetTrigger asChild>
              <button className="bg-foreground text-background px-8 py-3 rounded-full shadow-2xl shadow-black/20 flex items-center gap-3 active:scale-95 transition-transform">
                <SlidersHorizontal className="w-4 h-4" />
                <span className="text-xs font-black tracking-widest uppercase">تصفية</span>
                {(filters.stops.length > 0 || filters.timePeriods.length > 0 || filters.airlines.length > 0) && (
                  <span className="w-2 h-2 rounded-full bg-primary" />
                )}
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[85vh] rounded-t-[40px] border-t-0 p-0 overflow-hidden">
              <div className="w-12 h-1.5 bg-muted rounded-full mx-auto mt-4" />
              <SheetHeader className="px-6 pt-4 pb-0 text-right">
                <SheetTitle className="text-xl font-black">تصفية النتائج</SheetTitle>
              </SheetHeader>
              <div className="h-full overflow-y-auto px-6 pt-4 pb-24">
                <FlightFilters
                  offers={offers}
                  filters={filters}
                  onFilterChange={setFilters}
                />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      )}

      <BottomNav />
    </div>
  );
};

export default FlightResults;
