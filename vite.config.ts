import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { componentTagger } from "lovable-tagger";
import axios from "axios";

// ═══════════════════════════════════════════════════════════════════════════════
// STEP 1 – API KEY VALIDATION (runs at server startup)
// ═══════════════════════════════════════════════════════════════════════════════
function getApiKey(): string {
  const key = process.env.AVIATION_EDGE_KEY || 'dafa94-4486e5';
  if (!key) {
    console.error('\n⛔ [FATAL] AVIATION_EDGE_KEY is missing!');
  } else {
    console.log(`\n✅ [AviationEdge Key] ${key.slice(0, 4)}...`);
  }
  return key;
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEP 2 – HELPERS
// ═══════════════════════════════════════════════════════════════════════════════
function parseDateString(dateStr: string): string {
  if (dateStr.includes('/')) {
    const [d, m, y] = dateStr.split('/');
    return `${y}-${m}-${d}`;
  }
  return dateStr;
}

function generateRealisticPrice(flightNum: string): number {
  const base = 150000;
  const variance = (parseInt(flightNum.replace(/\D/g, '') || '0') % 15) * 10000;
  return base + variance;
}

function calculateDuration(depTime: string, arrTime: string): number {
  const [dh, dm] = depTime.split(':').map(Number);
  const [ah, am] = arrTime.split(':').map(Number);
  let durMins = (ah * 60 + am) - (dh * 60 + dm);
  if (durMins < 0) durMins += 24 * 60; 
  return durMins * 60;
}

function secsToDuration(secs: number): string {
  if (!secs || secs <= 0) return '';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return `${h > 0 ? h + 'h ' : ''}${m > 0 ? m + 'm' : ''}`.trim();
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEP 3 – LOCAL DEV API PLUGIN  (mirrors api/search-flights.ts exactly)
// ═══════════════════════════════════════════════════════════════════════════════
const localApiPlugin = () => ({
  name: 'local-api-plugin',
  configureServer(server: any) {
    server.middlewares.use('/api/search-flights', async (req: any, res: any, next: any) => {
      if (req.method !== 'POST') return next();

      let body = '';
      req.on('data', (chunk: any) => { body += chunk; });
      req.on('end', async () => {
        const AVIATION_EDGE_KEY = getApiKey();

        try {
          const parsed       = JSON.parse(body);
          const originUC     = String(parsed.origin      || '').trim().toUpperCase();
          const destUC       = String(parsed.destination || '').trim().toUpperCase();
          const date         = String(parsed.date || parsed.departure_date || '').trim();

          console.log(`\n${'═'.repeat(60)}`);
          console.log(`[localApi-AE] NEW SEARCH: ${originUC} → ${destUC} on ${date}`);

          if (!originUC || !destUC || !date) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, message: `حقول مطلوبة ناقصة` }));
            return;
          }

          // ── Call Aviation Edge ──────────────────────────────────────────────
          const baseURL = 'https://aviation-edge.com/v2/public/routes';
          const queryParams = {
            key: AVIATION_EDGE_KEY,
            departureIata: originUC,
            arrivalIata: destUC,
          };

          console.log(`[localApi-AE] → Requesting routes from Aviation Edge`);

          const response = await axios.get(baseURL, { params: queryParams, timeout: 15000 });
          const rawRoutes = response.data;

          if (rawRoutes?.error) {
            console.error(`❌ [localApi-AE] Error`, rawRoutes.error);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              success: false,
              message: `خطأ من مزود الطيران: ${rawRoutes.error.text || JSON.stringify(rawRoutes.error)}`,
            }));
            return;
          }

          if (!Array.isArray(rawRoutes) || rawRoutes.length === 0) {
            console.warn(`⚠️ [localApi-AE] 0 routes found for ${originUC} → ${destUC}`);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              success: false,
              message: `لا توجد رحلات مجدولة بين ${originUC} و ${destUC}.`,
            }));
            return;
          }

          console.log(`✅ [localApi-AE] Found ${rawRoutes.length} raw routes`);

          // ── Deduplicate similar routes (code-shares) ─────────────────────────
          const uniqueRoutes = rawRoutes.filter((route: any, index: number, self: any[]) =>
            index === self.findIndex((r) => (
              r.departureTime === route.departureTime &&
              r.airlineIata === route.airlineIata
            ))
          );

          console.log(`✅ [localApi-AE] Deduplicated to ${uniqueRoutes.length} active routes`);
          const isoDate = parseDateString(date);

          // ── Map to FlightOffer ──────────────────────────────────────────────
          const flights = uniqueRoutes.map((route: any, idx: number) => {
            const depTimeStr = route.departureTime || '10:00:00';
            const arrTimeStr = route.arrivalTime || '12:00:00';

            const depISO = `${isoDate}T${depTimeStr}`;
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
              airline:       carrier,
              airlineCode:   carrier,
              departureTime: depISO,
              arrivalTime:   arrISO,
              origin:        originUC,
              destination:   destUC,
              duration:      secsToDuration(durationSecs) || '2h 00m',
              price:         generateRealisticPrice(flightNum),
              currency:      'IQD',
              stops:         0,
              deepLink:      null,
            };
          });

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true, data: { flights } }));

        } catch (err: any) {
          const status     = err?.response?.status;
          const errorMsg   = err?.message;

          console.error('\n[localApi-AE] ❌ NETWORK ERROR:');
          console.error('  Status Code  :', status  ?? 'N/A');
          console.error('  Error Msg    :', errorMsg);

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            success: false,
            message: `فشل الاتصال بخادم Aviation Edge (${status ?? 'Network'}): ${errorMsg}`,
          }));
        }
      });
    });
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// VITE CONFIG
// ═══════════════════════════════════════════════════════════════════════════════
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: { overlay: false },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    localApiPlugin(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
