import axios from 'axios';

// ═══════════════════════════════════════════════════════════════════════════════
// AVIATION EDGE CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════
const AVIATION_EDGE_KEY = process.env.AVIATION_EDGE_KEY || 'dafa94-4486e5';

if (!AVIATION_EDGE_KEY) {
  console.error('❌ [FATAL] AVIATION_EDGE_KEY is missing!');
} else {
  console.log(`✅ [Aviation Edge] Loaded Key: ${AVIATION_EDGE_KEY.slice(0, 4)}...`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════
/** Convert DD/MM/YYYY back to YYYY-MM-DD for date manipulation if needed */
function parseDateString(dateStr: string): string {
  if (dateStr.includes('/')) {
    const [d, m, y] = dateStr.split('/');
    return `${y}-${m}-${d}`;
  }
  return dateStr;
}

/** Generate a realistic, stable price for a flight based on flight number */
function generateRealisticPrice(flightNum: string): number {
  const base = 150000;
  const variance = (parseInt(flightNum.replace(/\D/g, '') || '0') % 15) * 10000;
  return base + variance;
}

/** Calculate duration in seconds given two HH:mm:ss strings */
function calculateDuration(depTime: string, arrTime: string): number {
  const [dh, dm] = depTime.split(':').map(Number);
  const [ah, am] = arrTime.split(':').map(Number);
  let durMins = (ah * 60 + am) - (dh * 60 + dm);
  if (durMins < 0) durMins += 24 * 60; // Next day arrival
  return durMins * 60;
}

function secsToDuration(secs: number): string {
  if (!secs || secs <= 0) return '';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return `${h > 0 ? h + 'h ' : ''}${m > 0 ? m + 'm' : ''}`.trim();
}

// ═══════════════════════════════════════════════════════════════════════════════
// HANDLER (Vercel Serverless Function)
// ═══════════════════════════════════════════════════════════════════════════════
export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, message: 'Method Not Allowed' });
    return;
  }

  // 1. Extract params
  const { origin, destination, date: dateParam, departure_date } = req.body ?? {};
  const originUC      = String(origin      || '').trim().toUpperCase();
  const destUC        = String(destination || '').trim().toUpperCase();
  const requestedDate = String(dateParam || departure_date || '').trim();

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`[AviationEdge] NEW SEARCH: ${originUC} → ${destUC} on ${requestedDate}`);

  if (!originUC || !destUC || !requestedDate) {
    res.status(400).json({ success: false, message: 'Missing required fields' });
    return;
  }

  // 2. Call Aviation Edge "Routes" API
  // The Routes API returns all active schedules between two airports.
  try {
    const baseURL = 'https://aviation-edge.com/v2/public/routes';
    const queryParams = {
      key: AVIATION_EDGE_KEY,
      departureIata: originUC,
      arrivalIata: destUC,
    };

    const searchParams = new URLSearchParams(queryParams);
    console.log(`🔗 Requesting: ${baseURL}?departureIata=${originUC}&arrivalIata=${destUC}&key=***`);

    const response = await axios.get(baseURL, { params: queryParams, timeout: 15000 });
    const rawRoutes = response.data;

    // Aviation Edge returns an object with "error" if no routes found or invalid key
    if (rawRoutes?.error) {
      console.error(`❌ [AviationEdge Error]`, rawRoutes.error);
      res.status(200).json({
        success: false,
        message: `خطأ من مزود الطيران: ${rawRoutes.error.text || JSON.stringify(rawRoutes.error)}`,
      });
      return;
    }

    if (!Array.isArray(rawRoutes) || rawRoutes.length === 0) {
      console.warn(`⚠️ [AviationEdge] 0 routes found for ${originUC} → ${destUC}`);
      res.status(200).json({
        success: false,
        message: `لا توجد رحلات مجدولة بين ${originUC} و ${destUC}.`,
      });
      return;
    }

    console.log(`✅ [AviationEdge] Found ${rawRoutes.length} raw routes.`);

    // ── Deduplicate similar routes (code-shares) ─────────────────────────
    const uniqueRoutes = rawRoutes.filter((route: any, index: number, self: any[]) =>
      index === self.findIndex((r) => (
        r.departureTime === route.departureTime &&
        r.airlineIata === route.airlineIata
      ))
    );

    console.log(`✅ [AviationEdge] Deduplicated to ${uniqueRoutes.length} active routes.`);

    const isoDate = parseDateString(requestedDate); // YYYY-MM-DD

    // 3. Map Routes to FlightOffer Format
    const flights = uniqueRoutes.map((route: any, idx: number) => {
      // route.departureTime is usually "HH:mm:00"
      const depTimeStr = route.departureTime || '10:00:00';
      const arrTimeStr = route.arrivalTime || '12:00:00';

      const depISO = `${isoDate}T${depTimeStr}`;
      
      // Calculate arrival ISO (handling next day arrivals roughly)
      const durationSecs = calculateDuration(depTimeStr, arrTimeStr);
      const isNextDay = arrTimeStr < depTimeStr;
      
      let arrISO = `${isoDate}T${arrTimeStr}`;
      if (isNextDay) {
        const d = new Date(isoDate);
        d.setDate(d.getDate() + 1);
        arrISO = `${d.toISOString().split('T')[0]}T${arrTimeStr}`;
      }

      const carrier = (route.airlineIata || route.airlineIcao || 'UN').toUpperCase();
      const flightNum = route.flightNumber || String(100 + idx);

      return {
        id:            `AE-${idx}-${flightNum}`,
        airline:       carrier,         // Will be translated by frontend AIRLINE_MAP
        airlineCode:   carrier,
        departureTime: depISO,
        arrivalTime:   arrISO,
        origin:        originUC,
        destination:   destUC,
        duration:      secsToDuration(durationSecs) || '2h 00m',
        price:         generateRealisticPrice(flightNum),
        currency:      'IQD',
        stops:         0, // Routes API generally returns direct routes
        deepLink:      null,
      };
    });

    console.log(`✅ [AviationEdge] Mapped to ${flights.length} active flight offers.`);
    res.status(200).json({ success: true, data: { flights } });

  } catch (err: any) {
    const status = err?.response?.status;
    const errorMsg = err?.message;
    console.error('\n❌ [AviationEdge] NETWORK/SERVER ERROR');
    console.error('Status:', status);
    console.error('Msg:', errorMsg);
    
    res.status(200).json({
      success: false,
      message: `فشل الاتصال بخادم Aviation Edge (${status ?? 'Network'}): ${errorMsg}`
    });
  }
}
