/// <reference path="../deno.d.ts" />
// supabase/functions/search-flights/index.ts
import "https://deno.land/std@0.204.0/dotenv/load.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { fetchGoogleFlights } from "./googleFlights.ts";

const SAMPLE_FLIGHTS = [
  {
    id: "sample-1",
    airline: "Qatar Airways",
    airlineCode: "QR",
    airlineLogo: "https://images.kiwi.com/airlines/64/QR.png",
    departureTime: "09:15",
    arrivalTime: "13:05",
    origin: "BGW",
    destination: "AMM",
    duration: "3h 50m",
    price: 215,
    currency: "USD",
    stops: 0,
    is_bookable: true,
  },
  {
    id: "sample-2",
    airline: "Royal Jordanian",
    airlineCode: "RJ",
    airlineLogo: "https://images.kiwi.com/airlines/64/RJ.png",
    departureTime: "15:30",
    arrivalTime: "19:20",
    origin: "BGW",
    destination: "AMM",
    duration: "3h 50m",
    price: 189,
    currency: "USD",
    stops: 0,
    is_bookable: true,
  },
];

function getSampleFlights(origin: string, destination: string, date: string) {
  return SAMPLE_FLIGHTS.map((flight, index) => ({
    ...flight,
    id: `${flight.id}-${origin}-${destination}-${date}-${index}`,
    origin,
    destination,
  }));
}

async function fetchExternalFlights(body: any) {
  const endpoint = Deno.env.get("FLIGHTS_API_ENDPOINT") || "";
  const apiKey = Deno.env.get("FLIGHTS_API_KEY") || "";
  if (!endpoint || endpoint.includes("your-api.com")) return [];

  try {
    const resp = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { "Authorization": `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      console.warn('[SEARCH_FLIGHTS] External API error', resp.status);
      return [];
    }

    const data = await resp.json();
    return data.flights || data.results || data.data || [];
  } catch (err) {
    console.warn('[SEARCH_FLIGHTS] External provider failed:', err);
    return [];
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  try {
    const rawBody = await req.json();
    console.log('Request URL:', req.url);
    console.log('Raw request body:', JSON.stringify(rawBody));

    const body = rawBody?.params ? rawBody.params : rawBody;
    const { origin, destination, departure_date, date, return_date, passengers, cabin_class } = body;
    const departureDate = String(departure_date || date || '').trim();

    if (!origin || !destination || !departureDate) {
      return new Response(JSON.stringify({ error: "INVALID_PARAMS", message: "Origin, destination, and departure_date/date are required." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log(`Search request received: ${origin} -> ${destination} on ${departureDate}`);

    let flights = await fetchGoogleFlights({
      origin,
      destination,
      departure_date: departureDate,
      return_date,
      passengers,
      cabin_class,
    });

    if (!Array.isArray(flights) || flights.length === 0) {
      const rapidKey = Deno.env.get("RAPIDAPI_KEY");
      const externalFlights = await fetchExternalFlights({
        origin,
        destination,
        departure_date: departureDate,
        return_date,
        passengers,
        cabin_class,
      });

      if (Array.isArray(externalFlights) && externalFlights.length > 0) {
        console.log('[SEARCH_FLIGHTS] Using external FLIGHTS_API_ENDPOINT fallback provider');
        flights = externalFlights;
      } else if (!rapidKey) {
        console.warn('[SEARCH_FLIGHTS] No RAPIDAPI_KEY and no external provider; returning sample flights');
        flights = getSampleFlights(origin, destination, departureDate);
      }
    }

    console.log('Flight results count:', Array.isArray(flights) ? flights.length : 'invalid');

    if (!Array.isArray(flights) || flights.length === 0) {
      return new Response(JSON.stringify({ error: "NO_FLIGHTS_FOUND", message: "لم يتم العثور على رحلات. تأكد من صحة البيانات أو جرّب تاريخاً آخر." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ flights, total: flights.length }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (e: any) {
    return new Response(JSON.stringify({ error: "INTERNAL_ERROR", message: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});