// src/components/FlightResultCard.tsx
import React from 'react';
import { motion } from 'framer-motion';
import { Plane, ChevronLeft, Clock } from 'lucide-react';
import { Flight } from '../types';
import { cn, formatIQD } from '@/lib/utils';

interface FlightResultCardProps {
  flight: Flight;
  onClick?: () => void;
  index: number;
}

// ─── Extended airline map (Middle East + Iran + Iraq routes) ─────────────────
const AIRLINE_MAP: Record<string, { iata: string; name: string }> = {
  // Iraqi
  'IA':  { iata: 'IA',  name: 'الخطوط الجوية العراقية' },
  'IF':  { iata: 'IF',  name: 'فلاي بغداد' },
  // Iranian
  'IR':  { iata: 'IR',  name: 'إيران إير' },
  'W5':  { iata: 'W5',  name: 'ماهان إير' },
  'EP':  { iata: 'EP',  name: 'إيران أسمان' },
  'B9':  { iata: 'B9',  name: 'إيران إير تورز' },
  'QB':  { iata: 'QB',  name: 'قشم إير' },
  'RV':  { iata: 'RV',  name: 'كاسبيان إيرلاينز' },
  'I7':  { iata: 'I7',  name: 'طيران إيرانشهر' },
  'ZV':  { iata: 'ZV',  name: 'طيران إيراني' },
  // Gulf
  'FZ':  { iata: 'FZ',  name: 'فلاي دبي' },
  'EK':  { iata: 'EK',  name: 'طيران الإمارات' },
  'EY':  { iata: 'EY',  name: 'الاتحاد للطيران' },
  'QR':  { iata: 'QR',  name: 'الخطوط القطرية' },
  'GF':  { iata: 'GF',  name: 'طيران الخليج' },
  'KU':  { iata: 'KU',  name: 'الخطوط الكويتية' },
  'WY':  { iata: 'WY',  name: 'الطيران العُماني' },
  // Other
  'RJ':  { iata: 'RJ',  name: 'الملكية الأردنية' },
  'MS':  { iata: 'MS',  name: 'مصر للطيران' },
  'TK':  { iata: 'TK',  name: 'الخطوط التركية' },
  'SV':  { iata: 'SV',  name: 'الخطوط السعودية' },
  'G9':  { iata: 'G9',  name: 'العربية للطيران' },
  'OV':  { iata: 'OV',  name: 'طيران السلام' },
  'ME':  { iata: 'ME',  name: 'طيران الشرق الأوسط' },
  'PC':  { iata: 'PC',  name: 'طيران بيغاسوس' },
  'SQ':  { iata: 'SQ',  name: 'الخطوط السنغافورية' },
};

// ─── Extended Airport Map ─────────────────────────────────────────────────────
const AIRPORT_MAP: Record<string, string> = {
  // Iraq
  'BGW': 'بغداد (BGW)',
  'EBL': 'أربيل (EBL)',
  'BSR': 'البصرة (BSR)',
  'ISU': 'السليمانية (ISU)',
  'NJF': 'النجف (NJF)',
  // Iran
  'MHD': 'مشهد (MHD)',
  'IKA': 'طهران (IKA)',
  'THR': 'طهران - مهرآباد (THR)',
  'SYZ': 'شيراز (SYZ)',
  'IFN': 'أصفهان (IFN)',
  'TBZ': 'تبريز (TBZ)',
  'AWZ': 'الأهواز (AWZ)',
  // Lebanon & Syria & Jordan
  'BEY': 'بيروت (BEY)',
  'DAM': 'دمشق (DAM)',
  'AMM': 'عمان (AMM)',
  // Gulf
  'DXB': 'دبي (DXB)',
  'SHJ': 'الشارقة (SHJ)',
  'AUH': 'أبوظبي (AUH)',
  'DOH': 'الدوحة (DOH)',
  'KWI': 'الكويت (KWI)',
  'BAH': 'البحرين (BAH)',
  'MCT': 'مسقط (MCT)',
  // KSA
  'JED': 'جدة (JED)',
  'RUH': 'الرياض (RUH)',
  'MED': 'المدينة المنورة (MED)',
  'DMM': 'الدمام (DMM)',
  // Turkey
  'IST': 'إسطنبول (IST)',
  'SAW': 'صبيحة كوكجن (SAW)',
  'AYT': 'أنطاليا (AYT)',
  // Egypt
  'CAI': 'القاهرة (CAI)',
  'ALY': 'الإسكندرية (ALY)',
  'SSH': 'شرم الشيخ (SSH)'
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatTimeReadable = (dateStr: string): string => {
  if (!dateStr) return '--:--';
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    const h      = d.getHours();
    const m      = d.getMinutes();
    const period = h < 12 ? 'ص' : 'م';
    const h12    = h % 12 === 0 ? 12 : h % 12;
    return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
  }
  return dateStr;
};

const formatDateLabel = (dateStr: string): string => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('ar-IQ', { weekday: 'short', day: 'numeric', month: 'short' });
};

const formatDurationAr = (durationStr: string): string => {
  if (!durationStr || durationStr === '—') return '—';
  return durationStr.replace(/(\d+)h/, '$1س').replace(/(\d+)m/, ' $1د').trim();
};

// ─── Color palette per airline code ──────────────────────────────────────────
const AIRLINE_COLORS: Record<string, string> = {
  'IA': '#006633', 'IF': '#1a4fa0', 'IR': '#005faf',
  'W5': '#c8102e', 'B9': '#e8851b', 'QB': '#6d4c9b',
  'RV': '#0057a8', 'EP': '#1b7340', 'FZ': '#e5382e',
  'EK': '#c8102e', 'EY': '#b5914f', 'QR': '#5c0632',
  'GF': '#4a154b', 'KU': '#006e51', 'RJ': '#00427c',
  'MS': '#1b75bc', 'TK': '#e30a17', 'SV': '#006837',
  'G9': '#ff6600', 'FZE': '#e5382e',
};

const FlightResultCard: React.FC<FlightResultCardProps> = ({ flight, onClick, index }) => {
  // ── Schema validation / safe access ──────────────────────────────────────
  const code        = (flight?.airlineCode || '').toUpperCase();
  const mappedData  = AIRLINE_MAP[code];
  const airlineName = mappedData?.name || flight?.airline || 'شركة طيران';
  const iataCode    = mappedData?.iata  || code || 'UN';
  const accentColor = AIRLINE_COLORS[iataCode] || '#7c3aed';

  // Use avs.io for logos (supports IATA codes)
  const logoUrl = `https://pics.avs.io/200/200/${iataCode}.png`;

  const depTime   = formatTimeReadable(flight?.departureTime ?? '');
  const arrTime   = formatTimeReadable(flight?.arrivalTime   ?? '');
  const dateLabel = formatDateLabel(flight?.departureTime    ?? '');
  const duration  = formatDurationAr(flight?.duration        ?? '');
  const stops     = flight?.stops ?? 0;
  const isDirect  = stops === 0;
  const price     = typeof flight?.price === 'number' ? flight.price : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      onClick={onClick}
      className="relative mb-3 rounded-3xl overflow-hidden cursor-pointer group"
      dir="rtl"
    >
      <div className="bg-card border border-border/30 rounded-3xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden">

        {/* Top accent line colored by airline */}
        <div
          className="h-1 w-full"
          style={{ background: `linear-gradient(90deg, ${accentColor}99, ${accentColor}, ${accentColor}99)` }}
        />

        <div className="p-4 pb-0">
          {/* Row 1: Airline + badge */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center p-1 shrink-0 shadow-sm"
                style={{ backgroundColor: accentColor + '18', border: `1.5px solid ${accentColor}33` }}
              >
                <img
                  src={logoUrl}
                  alt={airlineName}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    const el = e.target as HTMLImageElement;
                    el.style.display = 'none';
                    const span = document.createElement('span');
                    span.className = 'text-[10px] font-black';
                    span.style.color = accentColor;
                    span.textContent = iataCode;
                    el.parentElement?.appendChild(span);
                  }}
                />
              </div>
              <div>
                <p className="text-[13px] font-bold text-foreground leading-tight">{airlineName}</p>
                {dateLabel && (
                  <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{dateLabel}</p>
                )}
              </div>
            </div>

            {/* Stops badge */}
            <div className={cn(
              'px-3 py-1 rounded-full text-[10px] font-black border',
              isDirect
                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                : 'bg-orange-500/10 text-orange-600 border-orange-500/20'
            )}>
              {isDirect ? '✈ مباشر' : `${stops} توقف`}
            </div>
          </div>

          {/* Row 2: Flight timeline */}
          <div className="flex items-center justify-between gap-2 py-2">
            {/* Departure */}
            <div className="text-right min-w-[80px]">
              <p className="text-[26px] font-black text-foreground tabular-nums leading-none tracking-tighter">
                {depTime.split(' ')[0]}
              </p>
              <p className="text-[11px] text-muted-foreground font-bold mt-1 max-w-[100px] truncate" title={AIRPORT_MAP[flight?.origin] || flight?.origin}>
                {depTime.split(' ')[1] || ''} · {AIRPORT_MAP[flight?.origin] || flight?.origin || '---'}
              </p>
            </div>

            {/* Center: duration + line */}
            <div className="flex-1 flex flex-col items-center gap-1.5">
              <div className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground">
                <Clock className="w-3 h-3" />
                <span>{duration}</span>
              </div>
              <div className="w-full relative flex items-center">
                <div className="flex-1 h-px bg-border/50" />
                <div
                  className="mx-1 w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                  style={{ backgroundColor: accentColor + '18', border: `1.5px solid ${accentColor}44` }}
                >
                  <Plane className="w-3 h-3 -rotate-45" style={{ color: accentColor }} strokeWidth={2.5} />
                </div>
                <div className="flex-1 h-px bg-border/50" />
              </div>
              {!isDirect && (
                <p className="text-[9px] font-bold text-orange-500">{stops} محطة توقف</p>
              )}
            </div>

            {/* Arrival */}
            <div className="text-left min-w-[80px]">
              <p className="text-[26px] font-black text-foreground tabular-nums leading-none tracking-tighter">
                {arrTime.split(' ')[0]}
              </p>
              <p className="text-[11px] text-muted-foreground font-bold mt-1 max-w-[100px] truncate text-left" title={AIRPORT_MAP[flight?.destination] || flight?.destination}>
                {AIRPORT_MAP[flight?.destination] || flight?.destination || '---'} · {arrTime.split(' ')[1] || ''}
              </p>
            </div>
          </div>
        </div>

        {/* Row 3: Price + Book button */}
        <div className="flex items-center justify-between gap-3 mt-3 px-4 py-3 border-t border-border/20"
             style={{ background: accentColor + '08' }}>
          <div className="flex flex-col">
            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">
              السعر / شخص
            </span>
            <div className="flex items-baseline gap-1">
              <span
                className="text-xl font-black tabular-nums leading-none"
                style={{ color: accentColor }}
              >
                {price > 0 ? formatIQD(price) : '---'}
              </span>
              <span className="text-[10px] font-bold text-muted-foreground">د.ع</span>
            </div>
          </div>

          <button
            onClick={(e) => { e.stopPropagation(); onClick?.(); }}
            className="flex items-center gap-2 text-white px-5 py-2.5 rounded-2xl text-[13px] font-black shadow-lg active:scale-95 transition-all duration-150"
            style={{ backgroundColor: accentColor, boxShadow: `0 4px 16px ${accentColor}44` }}
          >
            احجز الآن
            <ChevronLeft className="w-3.5 h-3.5" strokeWidth={3} />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default FlightResultCard;
