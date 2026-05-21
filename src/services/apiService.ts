// src/services/apiService.ts
import axios, { AxiosError } from 'axios';
import { supabase } from "@/integrations/supabase/client";
import { FlightOffer, HotelOffer } from '../types';

export interface HotelSearchResult {
  success: boolean;
  data: HotelOffer[];
  errorMessage?: string;
}

const API_URL = import.meta.env.VITE_BACKEND_URL || '/api';

// ─── Airline Directory ────────────────────────────────────────────────────────
const SINDIBAD_AIRLINE_MAP: Record<string, { iata: string; nameAr: string; nameEn: string; logo: string }> = {
  IA: { iata: 'IA', nameAr: 'الخطوط الجوية العراقية',        nameEn: 'Iraqi Airways',        logo: 'https://images.kiwi.com/airlines/64/IA.png' },
  QR: { iata: 'QR', nameAr: 'الخطوط الجوية القطرية',         nameEn: 'Qatar Airways',         logo: 'https://images.kiwi.com/airlines/64/QR.png' },
  RJ: { iata: 'RJ', nameAr: 'الملكية الأردنية',              nameEn: 'Royal Jordanian',       logo: 'https://images.kiwi.com/airlines/64/RJ.png' },
  FZ: { iata: 'FZ', nameAr: 'فلاي دبي',                     nameEn: 'flydubai',              logo: 'https://images.kiwi.com/airlines/64/FZ.png' },
  EK: { iata: 'EK', nameAr: 'طيران الإمارات',                nameEn: 'Emirates',              logo: 'https://images.kiwi.com/airlines/64/EK.png' },
  TK: { iata: 'TK', nameAr: 'الخطوط الجوية التركية',         nameEn: 'Turkish Airlines',      logo: 'https://images.kiwi.com/airlines/64/TK.png' },
  PC: { iata: 'PC', nameAr: 'طيران بيغاسوس',                 nameEn: 'Pegasus Airlines',      logo: 'https://images.kiwi.com/airlines/64/PC.png' },
  MS: { iata: 'MS', nameAr: 'مصر للطيران',                   nameEn: 'EgyptAir',              logo: 'https://images.kiwi.com/airlines/64/MS.png' },
  G9: { iata: 'G9', nameAr: 'العربية للطيران',               nameEn: 'Air Arabia',            logo: 'https://images.kiwi.com/airlines/64/G9.png' },
  EY: { iata: 'EY', nameAr: 'الاتحاد للطيران',               nameEn: 'Etihad Airways',        logo: 'https://images.kiwi.com/airlines/64/EY.png' },
  SV: { iata: 'SV', nameAr: 'الخطوط الجوية العربية السعودية', nameEn: 'Saudia',               logo: 'https://images.kiwi.com/airlines/64/SV.png' },
  KU: { iata: 'KU', nameAr: 'الخطوط الجوية الكويتية',        nameEn: 'Kuwait Airways',        logo: 'https://images.kiwi.com/airlines/64/KU.png' },
  GF: { iata: 'GF', nameAr: 'طيران الخليج',                  nameEn: 'Gulf Air',              logo: 'https://images.kiwi.com/airlines/64/GF.png' },
  WY: { iata: 'WY', nameAr: 'الطيران العماني',                nameEn: 'Oman Air',              logo: 'https://images.kiwi.com/airlines/64/WY.png' },
  ME: { iata: 'ME', nameAr: 'طيران الشرق الأوسط',            nameEn: 'Middle East Airlines',  logo: 'https://images.kiwi.com/airlines/64/ME.png' },
  J9: { iata: 'J9', nameAr: 'طيران الجزيرة',                 nameEn: 'Jazeera Airways',       logo: 'https://images.kiwi.com/airlines/64/J9.png' },
  XY: { iata: 'XY', nameAr: 'طيران ناس',                     nameEn: 'Flynas',                logo: 'https://images.kiwi.com/airlines/64/XY.png' },
  OV: { iata: 'OV', nameAr: 'طيران السلام',                  nameEn: 'SalamAir',              logo: 'https://images.kiwi.com/airlines/64/OV.png' },
  IR: { iata: 'IR', nameAr: 'الخطوط الجوية الإيرانية',       nameEn: 'Iran Air',              logo: 'https://images.kiwi.com/airlines/64/IR.png' },
  W5: { iata: 'W5', nameAr: 'ماهان إير',                     nameEn: 'Mahan Air',             logo: 'https://images.kiwi.com/airlines/64/W5.png' },
  LH: { iata: 'LH', nameAr: 'لوفتهانزا',                     nameEn: 'Lufthansa',             logo: 'https://images.kiwi.com/airlines/64/LH.png' },
  BA: { iata: 'BA', nameAr: 'الخطوط الجوية البريطانية',      nameEn: 'British Airways',       logo: 'https://images.kiwi.com/airlines/64/BA.png' },
  DL: { iata: 'DL', nameAr: 'دلتا',                          nameEn: 'Delta Air Lines',       logo: 'https://images.kiwi.com/airlines/64/DL.png' },
  AF: { iata: 'AF', nameAr: 'إير فرانس',                     nameEn: 'Air France',            logo: 'https://images.kiwi.com/airlines/64/AF.png' },
  SQ: { iata: 'SQ', nameAr: 'الخطوط الجوية السنغافورية',     nameEn: 'Singapore Airlines',    logo: 'https://images.kiwi.com/airlines/64/SQ.png' },
};

// ─── Per-route airline whitelist — Sindibad geographic calibration ────────────
// Each key is "ORIGIN-DESTINATION" (bidirectional lookup).
// The first code is the primary/most-likely carrier for this route.
const ROUTE_AIRLINE_WHITELIST: Record<string, string[]> = {
  // Iraq ↔ Iran
  'BGW-IKA': ['IA', 'IR', 'W5', 'QR', 'TK'],
  'BGW-THR': ['IA', 'IR', 'W5'],
  'BGW-MHD': ['IA', 'IR', 'W5'],
  'NJF-IKA': ['IA', 'IR', 'W5'],
  'NJF-MHD': ['IA', 'IR', 'W5'],
  'EBL-IKA': ['IA', 'IR', 'W5'],
  // Iraq ↔ Turkey
  'BGW-IST': ['IA', 'TK', 'PC', 'QR', 'FZ'],
  'BGW-SAW': ['IA', 'TK', 'PC'],
  'BGW-AYT': ['IA', 'TK', 'PC'],
  'EBL-IST': ['IA', 'TK', 'PC'],
  'NJF-IST': ['IA', 'TK', 'PC'],
  // Iraq ↔ UAE
  'BGW-DXB': ['IA', 'FZ', 'EK', 'G9'],
  'BGW-SHJ': ['IA', 'G9', 'FZ'],
  'BGW-AUH': ['IA', 'EY', 'FZ'],
  'EBL-DXB': ['IA', 'FZ', 'EK'],
  'NJF-DXB': ['IA', 'FZ', 'G9'],
  // Iraq ↔ Qatar
  'BGW-DOH': ['IA', 'QR'],
  'EBL-DOH': ['IA', 'QR'],
  'NJF-DOH': ['IA', 'QR'],
  // Iraq ↔ Jordan
  'BGW-AMM': ['IA', 'RJ', 'FZ', 'QR'],
  'EBL-AMM': ['IA', 'RJ'],
  'NJF-AMM': ['IA', 'RJ'],
  // Iraq ↔ Egypt
  'BGW-CAI': ['IA', 'MS', 'QR', 'EK'],
  // Iraq ↔ Saudi Arabia
  'BGW-RUH': ['IA', 'SV', 'FZ', 'QR'],
  'BGW-JED': ['IA', 'SV', 'FZ'],
  'BGW-DMM': ['IA', 'SV'],
  // Iraq ↔ Kuwait
  'BGW-KWI': ['IA', 'KU', 'J9'],
  'BSR-KWI': ['IA', 'KU', 'J9'],
  // Iraq ↔ Bahrain
  'BGW-BAH': ['IA', 'GF'],
  // Iraq ↔ Lebanon
  'BGW-BEY': ['IA', 'ME', 'RJ'],
  // Iraq ↔ Oman
  'BGW-MCT': ['IA', 'WY', 'FZ'],
};

const getRouteWhitelist = (origin: string, dest: string): string[] | null => {
  const o = origin.toUpperCase();
  const d = dest.toUpperCase();
  return ROUTE_AIRLINE_WHITELIST[`${o}-${d}`]
    || ROUTE_AIRLINE_WHITELIST[`${d}-${o}`]
    || null;
};

// ─── Route type classifier ────────────────────────────────────────────────────
const IRAQI_AIRPORTS = new Set(['BGW', 'EBL', 'ISU', 'BSR', 'NJF']);

const REGIONAL_AIRPORTS = new Set([
  'BGW', 'EBL', 'ISU', 'BSR', 'NJF',
  'DXB', 'SHJ', 'AUH', 'DWH', 'XNB',
  'DOH', 'AMM', 'AQJ',
  'CAI', 'HBE', 'SSH', 'HRG', 'LXR',
  'IST', 'SAW', 'AYT', 'ESB', 'ADB',
  'KWI', 'BAH', 'MCT', 'SLL',
  'RUH', 'JED', 'DMM', 'MED', 'AHB', 'TIF', 'ELQ',
  'BEY', 'DAM', 'ALP',
  'THR', 'IKA', 'SYZ', 'MHD', 'IFN', 'TBZ', 'KIH', 'GSM', 'AWZ', 'ABD', 'KSH',
  'KRT', 'GYD',
]);

const getRouteType = (o: string, d: string): 'domestic' | 'regional' | 'international' => {
  const ou = o.toUpperCase();
  const du = d.toUpperCase();
  if (IRAQI_AIRPORTS.has(ou) && IRAQI_AIRPORTS.has(du)) return 'domestic';
  if (REGIONAL_AIRPORTS.has(ou) && REGIONAL_AIRPORTS.has(du)) return 'regional';
  return 'international';
};


// ─── ApiService class ─────────────────────────────────────────────────────────
class ApiService {

  async searchFlights(params: any) {
    const origin      = String(params.origin      || '').trim().toUpperCase();
    const destination = String(params.destination || '').trim().toUpperCase();
    const date        = String(params.date || params.departure_date || '').trim();

    if (!origin || !destination || !date) {
      throw new Error('يرجى تحديد مطار الإقلاع والوصول وتاريخ السفر.');
    }

    console.log(`[ApiService] Flight search: ${origin} → ${destination} on ${date}`);

    try {
      const response = await axios.post(`${API_URL}/search-flights`, {
        origin,
        destination,
        date
      });
      
      const responseData = response.data?.data || response.data || {};
      
      // The exact path depends on the RapidAPI response structure. Usually it's in flights, itineraries, or data.
      let rawFlights = responseData.flights || responseData.itineraries || responseData.data || [];
      if (!Array.isArray(rawFlights)) {
        // If the API returns an object with nested arrays, we try to extract it or fallback to empty array
        rawFlights = Object.values(rawFlights).find(Array.isArray) || [];
      }
      const flights: FlightOffer[] = [];

      for (const raw of rawFlights) {
        // Safe mapping using Adapter pattern
        const firstLeg = raw.legs?.[0] || {};
        const marketing = firstLeg.carriers?.marketing?.[0] || {};
        
        let durationStr = '0h 0m';
        if (raw.duration) {
          durationStr = typeof raw.duration === 'number' ? `${Math.floor(raw.duration / 60)}h ${raw.duration % 60}m` : String(raw.duration);
        } else if (firstLeg.durationInMinutes) {
          durationStr = `${Math.floor(firstLeg.durationInMinutes / 60)}h ${firstLeg.durationInMinutes % 60}m`;
        }

        const flight: FlightOffer = {
          id: raw.id || Math.random().toString(36).substr(2, 9),
          airline: raw.airline || raw.carrier || marketing.name || 'Unknown Airline',
          airlineCode: raw.airlineCode || marketing.id || 'UN',
          airlineLogo: raw.airlineLogo || marketing.logoUrl || '',
          departureTime: raw.departureTime || raw.departure_time || firstLeg.departure || '00:00',
          arrivalTime: raw.arrivalTime || raw.arrival_time || firstLeg.arrival || '00:00',
          origin: origin,
          destination: destination,
          duration: durationStr,
          price: raw.price?.raw || raw.price || 0,
          currency: raw.currency || raw.price?.currency || 'USD',
          stops: raw.stops !== undefined ? raw.stops : (firstLeg.stopCount || 0),
          is_bookable: true,
        };
        flights.push(flight);
      }

      const routeType = getRouteType(origin, destination);

      return {
        success: true,
        route_classification: routeType,
        total_available_flights: flights.length,
        flights: flights
      };
    } catch (error: any) {
      console.error('[ApiService] Flight search failed:', error);
      const msg = error.response?.data?.error || error.message || 'عذراً، خطوط الاتصال مشغولة حالياً، يرجى إعادة المحاولة.';
      throw new Error(msg);
    }
  }

  // ─── Hotels ────────────────────────────────────────────────────────────────

  async searchHotels(params: any): Promise<HotelSearchResult> {
    try {
      const response = await axios.post(`${API_URL}/scrape-hotels`, {
        cityName:     params.city || params.location,
        cityId:       params.cityId   || null,
        countryId:    params.countryId || 17,
        checkIn:      params.checkIn,
        checkOut:     params.checkOut,
        adultsCount:  params.adults || 2,
        childrenAges: params.childrenAges || [],
      });

      const body = response.data;
      if (body.success === false) {
        return {
          success: false,
          data: [],
          errorMessage: typeof body.message === 'object'
            ? JSON.stringify(body.message)
            : (body.message || 'Failed to fetch hotel data.'),
        };
      }

      const PROFIT_MARGIN = 1.10;
      const hotelsData    = body.data?.hotels || body.data || [];

      const hotels: HotelOffer[] = (Array.isArray(hotelsData) ? hotelsData : []).map((h: any) => ({
        ...h,
        price: typeof h.price === 'string'
          ? (parseInt(h.price.replace(/,/g, ''), 10) * PROFIT_MARGIN).toLocaleString()
          : (h.price * PROFIT_MARGIN).toLocaleString(),
      }));

      return { success: true, data: hotels };
    } catch (error) {
      const axiosErr = error as AxiosError<any>;
      const msg = axiosErr.response?.data?.message
        || axiosErr.response?.data?.error
        || axiosErr.message
        || 'Network error.';
      console.error('[ApiService] Hotel search failed:', msg);
      return {
        success: false,
        data: [],
        errorMessage: typeof msg === 'object' ? JSON.stringify(msg) : msg,
      };
    }
  }

  async getHotelRegions(query: string) {
    const { data, error } = await supabase.functions.invoke('search-hotels', {
      body: { action: 'regions', query },
    });
    if (error) throw error;
    return data.regions || [];
  }

  async fetchHotelDetails(payload: any) {
    try {
      const response = await axios.post(`${API_URL}/hotel-details`, payload);
      return response.data;
    } catch (error) {
      console.error('[ApiService] Error fetching hotel details:', error);
      return { success: false, errorMessage: 'Failed to fetch hotel details.' };
    }
  }

  async getHotelDetails(locationId: string) {
    const { data, error } = await supabase.functions.invoke('search-hotels', {
      body: { locationId },
    });
    if (error) throw error;
    return data.hotel;
  }

  async createBooking(payload: any) {
    try {
      const response = await axios.post(`${API_URL}/create-booking`, payload);
      return response.data;
    } catch (error) {
      console.error('[ApiService] Error creating booking:', error);
      throw new Error('Failed to create booking on the server.');
    }
  }

  async getBookings() {
    try {
      const response = await axios.get(`${API_URL}/bookings`);
      return response.data;
    } catch (error) {
      console.error('[ApiService] Error fetching bookings:', error);
      return { success: false, data: [] };
    }
  }
}

export const apiService = new ApiService();
