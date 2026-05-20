// src/types/index.ts

// ─── Core Flight Types ────────────────────────────────────────────────────────

export interface FlightSegment {
  airline_code: string;
  airline_name: string;
  flight_number: string;
  departure_airport: string;
  arrival_airport: string;
  departure_time: string;
  arrival_time: string;
  duration: number;     // minutes
  cabin_class: string;
}

export interface Flight {
  id: string;
  airline: string;
  airlineCode?: string;
  airlineLogo?: string;
  departureTime: string;
  arrivalTime: string;
  origin: string;
  destination: string;
  duration: string;
  price: number;        // always in IQD on display
  currency?: string;
  stops: number;
  is_bookable?: boolean;
  segments?: FlightSegment[];
  // Sorting scores pre-computed by apiService
  scoreCheapest?: number;
  scoreFastest?: number;
  scoreBest?: number;
}

export type FlightOffer = Flight;

// ─── Booking & Passenger Types ────────────────────────────────────────────────

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';
export type BookingStatus = 'confirmed' | 'pending' | 'cancelled';

export interface PassengerData {
  firstName: string;
  lastName: string;
  dob: string;           // ISO date
  nationality: string;
  passportNumber: string;
  passportExpiry: string; // ISO date
  type: 'adult' | 'child' | 'infant';
}

export interface FlightBookingRecord {
  id?: string;           // UUID assigned by Supabase
  booking_ref: string;   // human-readable reference e.g. SHL-20260519-XXXX
  flight_id: string;
  flight_data: Flight;   // full snapshot of flight at booking time
  passengers: PassengerData[];
  total_price_iqd: number;
  profit_margin: number; // e.g. 0.10
  payment_status: PaymentStatus;
  booking_status: BookingStatus;
  created_at?: string;
  updated_at?: string;
  user_id?: string | null; // nullable for guest bookings
  contact_phone?: string;
  contact_email?: string;
}

// ─── Hotel Types ──────────────────────────────────────────────────────────────

export interface Hotel {
  hotelId: number | string;
  name: string;
  image: string;
  stars: number;
  rating: number;
  reviewsCount?: number;
  price: string | number;
  provider?: string;
  location?: string;
}

export type HotelOffer = Hotel;

// ─── Search Progress ──────────────────────────────────────────────────────────

export interface SearchProgressResponse {
  status: 'pending' | 'completed' | 'error' | 'ready_for_integration';
  progress: number;
  offers: Flight[];
  total?: number;
  message?: string;
}
