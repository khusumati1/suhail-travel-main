// src/services/apiService.ts
import axios, { AxiosError } from 'axios';
import { FlightOffer, HotelOffer } from '../types';

export interface HotelSearchResult {
  success: boolean;
  data: HotelOffer[];
  errorMessage?: string;
}

const API_URL = import.meta.env.VITE_BACKEND_URL || '/api';

// ═══════════════════════════════════════════════════════════════════════════════
// DATA TRANSFORMATION & VALIDATION LAYER
// ═══════════════════════════════════════════════════════════════════════════════

/** Transforms YYYY-MM-DD to DD/MM/YYYY automatically */
function formatFlightQuery(dateStr: string): string {
  if (!dateStr || !dateStr.includes('-')) return dateStr;
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

/** Parses and logs API responses for better debugging */
function parseApiResponse(response: any, params: any) {
  const data = response.data;
  if (!data || data.success === false || data.error || (data.data?.flights && data.data.flights.length === 0)) {
    console.error('\n❌ [API Rejected / Empty Response]');
    console.error(`   Reason: ${data?.message || data?.error || '0 Flights Returned'}`);
    console.log(`   Sent Route: ${params.origin} → ${params.destination}`);
    console.log(`   Sent Date: ${params.departure_date}\n`);
  }
  return response;
}

// Request Interceptor: Auto-format dates and validate IATA codes
axios.interceptors.request.use((config) => {
  if (config.url?.includes('/search-flights')) {
    const data = config.data || {};
    
    // Validation Layer (IATA Code check)
    if (data.origin && typeof data.origin === 'string' && data.origin.trim().length !== 3) {
      console.warn(`⚠️ [Validation Warning] Origin code "${data.origin}" is not a 3-letter IATA code!`);
    }
    if (data.destination && typeof data.destination === 'string' && data.destination.trim().length !== 3) {
      console.warn(`⚠️ [Validation Warning] Destination code "${data.destination}" is not a 3-letter IATA code!`);
    }

    // Transformation Layer (Date formatting)
    if (data.departure_date) {
      data.departure_date = formatFlightQuery(data.departure_date);
    }
    if (data.return_date) {
      data.return_date = formatFlightQuery(data.return_date);
    }
  }
  return config;
});

// Response Interceptor: Catch and parse errors globally
axios.interceptors.response.use(
  (response) => {
    if (response.config.url?.includes('/search-flights')) {
      const sentParams = response.config.data ? JSON.parse(response.config.data) : {};
      parseApiResponse(response, sentParams);
    }
    return response;
  },
  (error) => {
    if (error.config?.url?.includes('/search-flights')) {
      console.error('\n❌ [API Network/Server Error]');
      console.error(`   Message: ${error.message}`);
      if (error.response) {
        console.error(`   Status: ${error.response.status}`);
        console.error(`   Data:`, error.response.data);
      }
      console.log('\n');
    }
    return Promise.reject(error);
  }
);

// ═══════════════════════════════════════════════════════════════════════════════

class ApiService {

  async searchFlights(params: any) {
    const origin      = String(params.origin      || '').trim().toUpperCase();
    const destination = String(params.destination || '').trim().toUpperCase();
    const date        = String(params.date || params.departure_date || '').trim();

    if (!origin || !destination || !date) {
      throw new Error('يرجى تحديد مطار الإقلاع والوصول وتاريخ السفر.');
    }

    console.log(`[ApiService] Flight search initiated: ${origin} → ${destination} on ${date}`);

    try {
      const payload: any = {
        origin,
        destination,
        departure_date: date,
      };
      
      if (params.return_date) payload.return_date = params.return_date;
      if (params.passengers) payload.passengers = params.passengers;
      if (params.cabin_class) payload.cabin_class = params.cabin_class;

      const response = await axios.post(`${API_URL}/search-flights`, payload);
      
      const responseData = response.data?.data || {};
      const flights: FlightOffer[] = responseData.flights || [];

      return {
        success: true,
        total_available_flights: flights.length,
        flights: flights
      };
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message || 'عذراً، فشل البحث عن الرحلات.';
      throw new Error(msg);
    }
  }

  async searchHotels(params: any): Promise<HotelSearchResult> {
    try {
      const response = await axios.post(`${API_URL}/scrape-hotels`, {
        cityName:     params.city || params.location,
        checkIn:      params.checkIn,
        checkOut:     params.checkOut,
        adultsCount:  params.adults || 2,
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

      const hotelsData = body.data?.hotels || body.data || [];
      const hotels: HotelOffer[] = (Array.isArray(hotelsData) ? hotelsData : []).map((h: any) => ({
        ...h
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
