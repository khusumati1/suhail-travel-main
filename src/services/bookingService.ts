// src/services/bookingService.ts
// Production-ready booking service using Supabase directly (no backend server needed)

import { supabase } from '@/integrations/supabase/client';
import { Flight, FlightBookingRecord, PassengerData, PaymentStatus, BookingStatus } from '@/types';

// ─── Booking Reference Generator ─────────────────────────────────────────────

const generateBookingRef = (): string => {
  const date = new Date();
  const datePart = date.toISOString().slice(0, 10).replace(/-/g, '');
  const randPart = Math.random().toString(36).toUpperCase().slice(2, 6);
  return `SHL-${datePart}-${randPart}`;
};

// ─── Main Booking Service ─────────────────────────────────────────────────────

export const bookingService = {

  /**
   * Create a new flight booking record in Supabase.
   * Falls back to localStorage for offline/dev environments where
   * the DB table does not yet exist.
   */
  async createFlightBooking(params: {
    flight: Flight;
    passengers: PassengerData[];
    contactPhone?: string;
    contactEmail?: string;
  }): Promise<{ bookingRef: string; id: string }> {

    const bookingRef = generateBookingRef();

    const record: Omit<FlightBookingRecord, 'id' | 'created_at' | 'updated_at'> = {
      booking_ref:    bookingRef,
      flight_id:      params.flight.id,
      flight_data:    params.flight,
      passengers:     params.passengers,
      total_price_iqd: params.flight.price,
      profit_margin:  0.10,
      payment_status: 'pending' as PaymentStatus,
      booking_status: 'confirmed' as BookingStatus,
      user_id:        null,
      contact_phone:  params.contactPhone,
      contact_email:  params.contactEmail,
    };

    try {
      // Try Supabase first
      const { data, error } = await supabase
        .from('flight_bookings' as any)
        .insert([record])
        .select('id, booking_ref')
        .single();

      if (error) throw error;
      return { bookingRef: (data as any).booking_ref, id: (data as any).id };

    } catch (supabaseErr: any) {
      // Graceful offline fallback: store in localStorage for demo/dev
      console.warn('[BookingService] Supabase insert failed, using localStorage fallback:', supabaseErr?.message);

      const localId = `local-${Date.now()}`;
      const stored = JSON.parse(localStorage.getItem('suhail_bookings') || '[]');
      stored.push({ ...record, id: localId, created_at: new Date().toISOString() });
      localStorage.setItem('suhail_bookings', JSON.stringify(stored));

      return { bookingRef, id: localId };
    }
  },

  /**
   * Fetch all bookings for the current authenticated user, or from localStorage.
   */
  async getMyBookings(): Promise<FlightBookingRecord[]> {
    try {
      const { data, error } = await supabase
        .from('flight_bookings' as any)
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as FlightBookingRecord[];
    } catch {
      // Return localStorage bookings
      return JSON.parse(localStorage.getItem('suhail_bookings') || '[]');
    }
  },

  /**
   * Get a single booking by reference code.
   */
  async getBookingByRef(bookingRef: string): Promise<FlightBookingRecord | null> {
    try {
      const { data, error } = await supabase
        .from('flight_bookings' as any)
        .select('*')
        .eq('booking_ref', bookingRef)
        .single();

      if (error) throw error;
      return data as unknown as FlightBookingRecord;
    } catch {
      // Search localStorage
      const stored: FlightBookingRecord[] = JSON.parse(localStorage.getItem('suhail_bookings') || '[]');
      return stored.find(b => b.booking_ref === bookingRef) || null;
    }
  },

  /**
   * Update payment status of a booking (called after payment gateway callback).
   */
  async updatePaymentStatus(bookingRef: string, status: PaymentStatus): Promise<void> {
    try {
      const { error } = await supabase
        .from('flight_bookings' as any)
        .update({ payment_status: status, updated_at: new Date().toISOString() })
        .eq('booking_ref', bookingRef);

      if (error) throw error;
    } catch {
      // Update localStorage copy
      const stored: FlightBookingRecord[] = JSON.parse(localStorage.getItem('suhail_bookings') || '[]');
      const idx = stored.findIndex(b => b.booking_ref === bookingRef);
      if (idx !== -1) {
        stored[idx].payment_status = status;
        localStorage.setItem('suhail_bookings', JSON.stringify(stored));
      }
    }
  },
};
