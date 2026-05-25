const RAPIDAPI_HOST = 'google-flights2.p.rapidapi.com';
const API_PATH = '/api/v1/searchFlights';
const TIMEOUT_MS = 20_000;

type FlightOffer = {
  id: string;
  airline: string;
  airlineCode?: string;
  airlineLogo?: string;
  departureTime: string;
  arrivalTime: string;
  origin: string;
  destination: string;
  duration: string;
  price: number;
  currency: string;
  stops: number;
  is_bookable: boolean;
  segments?: any[];
};

function normalizeDuration(value: any): string {
  if (typeof value === 'number') {
    const hours = Math.floor(value / 60);
    const minutes = value % 60;
    return `${hours}h ${minutes}m`;
  }

  if (typeof value === 'string') {
    return value;
  }

  return '0h 0m';
}

function normalizeFlight(raw: any, origin: string, destination: string): FlightOffer | null {
  try {
    const price = Number(raw.price?.amount ?? raw.price ?? raw.total_price ?? raw.total ?? raw.fare ?? 0);
    if (!price || price <= 0) return null;

    const airline = raw.airline || raw.carrier || raw.marketing_carrier || raw.airline_name || 'Unknown Airline';
    const airlineCode = raw.airline_code || raw.carrier_code || raw.marketing_carrier_code || '';
    const depart = raw.departure_time || raw.departure_datetime || raw.departure || raw.departure_at || raw.departureDate || '';
    const arrive = raw.arrival_time || raw.arrival_datetime || raw.arrival || raw.arrival_at || raw.arrivalDate || '';
    const originCode = raw.departure_id || raw.origin || raw.from || origin;
    const destinationCode = raw.arrival_id || raw.destination || raw.to || destination;
    const stops = Number(raw.stops ?? raw.stop_count ?? raw.segment_count ?? 0);
    const cabinClass = raw.travel_class || raw.cabin_class || raw.cabin || 'economy';
    const duration = normalizeDuration(raw.duration ?? raw.fly_duration ?? raw.total_duration ?? raw.duration_text ?? raw.durationDisplay);

    return {
      id: raw.id || raw.flight_id || `${origin}-${destination}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      airline,
      airlineCode,
      airlineLogo: raw.airline_logo || raw.carrier_logo || raw.logo || '',
      departureTime: depart,
      arrivalTime: arrive,
      origin: String(originCode).toUpperCase(),
      destination: String(destinationCode).toUpperCase(),
      duration,
      price,
      currency: raw.currency || raw.price?.currency || raw.total_currency || 'USD',
      stops: Number.isFinite(stops) ? stops : 0,
      is_bookable: Boolean(raw.booking_url || raw.deep_link || raw.bookable),
      segments: Array.isArray(raw.segments) ? raw.segments : undefined,
    };
  } catch (_err) {
    return null;
  }
}

export async function fetchGoogleFlights(params: {
  origin: string;
  destination: string;
  departure_date: string;
  return_date?: string;
  passengers?: {
    adults?: number;
    children?: number;
    infants?: number;
  };
  cabin_class?: string;
}): Promise<FlightOffer[]> {
  const apiKey = Deno.env.get('RAPIDAPI_KEY');
  if (!apiKey) {
    console.error('[GOOGLE_FLIGHTS] Missing RAPIDAPI_KEY');
    return [];
  }

  const url = new URL(`https://${RAPIDAPI_HOST}${API_PATH}`);
  url.searchParams.set('departure_id', params.origin.toUpperCase());
  url.searchParams.set('arrival_id', params.destination.toUpperCase());
  url.searchParams.set('travel_class', (params.cabin_class || 'ECONOMY').toUpperCase());
  url.searchParams.set('adults', String(params.passengers?.adults ?? 1));
  if (params.passengers?.children) url.searchParams.set('children', String(params.passengers.children));
  if (params.passengers?.infants) url.searchParams.set('infants', String(params.passengers.infants));
  url.searchParams.set('show_hidden', '1');
  url.searchParams.set('currency', 'USD');
  url.searchParams.set('language_code', 'en-US');
  url.searchParams.set('country_code', 'US');
  url.searchParams.set('search_type', 'best');
  url.searchParams.set('departure_date', params.departure_date);
  if (params.return_date) {
    url.searchParams.set('return_date', params.return_date);
  }

  console.log('[GOOGLE_FLIGHTS] Request URL:', url.toString());

  try {
    const resp = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': RAPIDAPI_HOST,
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    const bodyText = await resp.text();
    let data: any = null;
    try {
      data = JSON.parse(bodyText);
    } catch (_parseErr) {
      console.error('[GOOGLE_FLIGHTS] Invalid JSON response');
      return [];
    }

    if (!resp.ok) {
      console.error('[GOOGLE_FLIGHTS] API error', resp.status, data);
      return [];
    }

    const flightItems = data.flights || data.data || data.results || data.search_results || data.items || [];
    const normalized = Array.isArray(flightItems)
      ? flightItems.map((item: any) => normalizeFlight(item, params.origin, params.destination)).filter((item: FlightOffer | null): item is FlightOffer => item !== null)
      : [];

    console.log(`[GOOGLE_FLIGHTS] Normalized ${normalized.length} offers`);
    return normalized;
  } catch (err: any) {
    console.error('[GOOGLE_FLIGHTS] Fetch failed:', err.message);
    return [];
  }
}
