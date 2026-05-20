import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';
import puppeteerCore from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
];

async function getSessionFromBrowser(browser: any, userAgent: string) {
  const page = await browser.newPage();
  try {
    // 1. التخفي اليدوي (Manual Evasions) لتجنب الحاجة لمكتبة StealthPlugin ومشاكل Bundling
    await page.setUserAgent(userAgent);
    
    await page.evaluateOnNewDocument(() => {
      // إخفاء خاصية webdriver
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
      // إيهام الموقع بوجود إضافات (plugins) كالمتصفح الحقيقي
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3], 
      });
      // تمويه اللغات
      Object.defineProperty(navigator, 'languages', {
        get: () => ['ar', 'en-US', 'en'],
      });
    });

    // الانتقال للموقع
    await page.goto('https://sindibad.iq/', { waitUntil: 'networkidle2', timeout: 30000 });
    
    // الانتظار قليلاً لضمان تحميل الـ Token
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // استخراج accept-token
    const token = await page.evaluate(() => {
      const meta = document.querySelector('meta[name="accept-token"]');
      if (meta) return meta.getAttribute('content');
      
      if ((window as any).__TOKEN__) return (window as any).__TOKEN__;
      
      const match = document.cookie.match(/accept-token=([^;]+)/);
      if (match) return match[1];
      
      return null;
    });
    
    // استخراج Cookies
    const cookiesArray = await page.cookies();
    const cookiesString = cookiesArray.map((c: any) => `${c.name}=${c.value}`).join('; ');
    
    return { token, cookies: cookiesString };
  } finally {
    await page.close(); // إغلاق الصفحة بعد جلب البيانات
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // إعدادات الـ CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { origin, destination, date } = req.body;
  if (!origin || !destination || !date) {
    return res.status(400).json({ success: false, message: 'Missing parameters: origin, destination, date' });
  }

  let browser: any = null;
  
  try {
    // 2. إعداد المتصفح باستخدام puppeteer-core فقط مع sparticuz
    const args = [
      ...chromium.args,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-web-security'
    ];
    
    browser = await puppeteerCore.launch({
      args: args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
    });

    let attempt = 0;
    const maxAttempts = 2;
    let finalError = null;

    while (attempt < maxAttempts) {
      const userAgent = USER_AGENTS[attempt];
      try {
        // استخراج الـ accept-token و الـ cookies
        const session = await getSessionFromBrowser(browser, userAgent);
        
        if (!session.token) {
          throw new Error('لم يتم العثور على رمز التوثيق (accept-token).');
        }

        // 3. استخدام axios للقيام بعملية البحث لتسريع الأداء
        const payload = {
          search: {
            segments: [
              {
                departure_airport: origin,
                arrival_airport: destination,
                departure_date: date
              }
            ],
            passengers: { adults: 1, children: 0, infants: 0 },
            cabin_class: "Economy"
          }
        };

        const response = await axios.post(
          'https://api.sindibad.iq/api/v1/plp/flightsearch/start-search',
          payload,
          {
            headers: {
              'User-Agent': userAgent,
              'Accept': 'application/json, text/plain, */*',
              'Accept-Language': 'ar,en-US;q=0.9',
              'Referer': 'https://sindibad.iq/',
              'Origin': 'https://sindibad.iq',
              'accept-token': session.token,
              'Cookie': session.cookies,
              'Content-Type': 'application/json'
            },
            timeout: 25000,
          }
        );

        // تحويل البيانات (Data Mapping)
        const rawData = response.data;
        const flightsArray = rawData?.data?.flights || rawData?.flights || rawData?.data || [];
        
        if (!Array.isArray(flightsArray)) {
          return res.json({ success: true, data: [] });
        }

        const mappedFlights = flightsArray.map((flight: any) => {
          let airlineName = 'Unknown Airline';
          if (flight.airline) {
             airlineName = flight.airline.name || flight.airline;
          } else if (flight.segments && flight.segments[0] && flight.segments[0].airline) {
             airlineName = flight.segments[0].airline.name;
          }
      
          let price = 0;
          if (flight.price && typeof flight.price === 'object') {
            price = flight.price.amount || flight.price.total || 0;
          } else {
            price = parseFloat(flight.price) || 0;
          }
      
          const departureTime = flight.departureTime || (flight.segments && flight.segments[0]?.departureTime) || date;
          const arrivalTime = flight.arrivalTime || (flight.segments && flight.segments[flight.segments.length - 1]?.arrivalTime) || date;
          const duration = flight.duration || (flight.segments && flight.segments[0]?.duration) || '0h 0m';
          
          const flightId = flight.id || flight.flightId || `snd-${Date.now()}`;
          const bookingLink = flight.bookingLink || flight.deepLink || `https://sindibad.iq/flights/book?flightId=${flightId}`;
      
          return {
            airline: airlineName,
            price: price,
            departure: departureTime,
            arrival: arrivalTime,
            duration: duration,
            link: bookingLink
          };
        });

        return res.json({ success: true, data: mappedFlights });

      } catch (error: any) {
        attempt++;
        finalError = error;
        
        // إعادة المحاولة عند حظر الـ 403
        if (error.response && (error.response.status === 403 || error.response.status === 401)) {
          if (attempt < maxAttempts) {
            console.warn(`[SindibadProxy] 403 Blocked. Retrying with different User-Agent (Attempt ${attempt + 1})...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
            continue;
          }
        }
        
        break; // إنهاء المحاولات لباقي أنواع الأخطاء
      }
    }

    // إرجاع رسالة خطأ في حالة الفشل النهائي
    return res.status(500).json({
      success: false,
      message: 'فشل في جلب البيانات من المصدر بعد عدة محاولات.',
      error: finalError?.message || 'Unknown error'
    });

  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'حدث خطأ غير متوقع أثناء تهيئة المتصفح.',
      error: error.message
    });
  } finally {
    // 4. إغلاق المتصفح فوراً في بلوك finally لمنع Memory Leaks
    if (browser) {
      try {
        await browser.close();
      } catch (e) {
        console.error('Error closing browser:', e);
      }
    }
  }
}
