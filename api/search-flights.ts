import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';

// مفتاح SerpApi المحقون من متغيرات البيئة
const SERPAPI_KEY = process.env.VITE_SERPAPI_API_KEY || process.env.SERPAPI_API_KEY;

/**
 * [المنطق الهندسي]: دالة مساعدة لتنسيق الوقت.
 * تقوم بالتقاط أي صيغة وقت (سواء كانت كاملة مع تاريخ أو مجرد ساعة) 
 * وتحويلها لصيغة مقروءة محلياً. يتم تجاهل الأخطاء بصمت وإرجاع النص الأصلي كخطة طوارئ.
 * @param timeString النص القادم من API
 */
function formatTime(timeString: string | null | undefined): string {
  if (!timeString) return 'غير محدد';
  
  try {
    const dateObj = new Date(timeString);
    if (!isNaN(dateObj.getTime())) {
      // تنسيق التوقيت ليتناسب مع المنطقة الزمنية المطلوبة (مثال: ar-IQ)
      return dateObj.toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' });
    }
  } catch (e) {
    // صمت هندسي (Silent Fail) في حال فشل التحليل
  }
  
  return timeString;
}

/**
 * [المنطق الهندسي]: دالة استخراج وتوحيد بيانات الرحلة (Data Extraction & Normalization).
 * تعتمد بالكامل على Optional Chaining (?.) و Nullish Coalescing (??) 
 * لمنع انهيار النظام بسبب أي مسارات JSON غير موجودة أو معقدة.
 */
function extractFlightData(flightItem: any, origin: string, destination: string, date: string) {
  // 1. استخراج مقاطع الرحلة بمسارات بديلة (Fall-through Strategy)
  const segments = 
    flightItem?.flights ?? 
    flightItem?.segments ?? 
    (flightItem?.first_flight ? [flightItem.first_flight] : []);
    
  const firstSegment = segments[0] ?? {};
  const lastSegment = segments[segments.length - 1] ?? {};

  // 2. شركة الطيران وكود IATA
  const airlineName = firstSegment?.airline ?? flightItem?.airline ?? 'Unknown Airline';
  const flightNumber = firstSegment?.flight_number ?? flightItem?.flight_number ?? '';
  const airlineCode = flightNumber.split(' ')?.[0] ?? ''; 
  
  // 3. السعر (Data Sanitization & Scaling)
  let rawPrice = flightItem?.price ?? 0;
  if (rawPrice > 0 && rawPrice < 1000) {
    rawPrice = rawPrice * 1000; // تحويل الأسعار الصغيرة للآلاف
  }
  
  // تنسيق السعر كـ IQD في الـ Backend باستخدام Intl.NumberFormat
  let formattedPrice = '';
  if (rawPrice > 0) {
    formattedPrice = new Intl.NumberFormat('ar-IQ').format(rawPrice) + ' د.ع';
  }
  
  // 4. محطات التوقف (Stops Count)
  let stops = 0;
  if (Array.isArray(flightItem?.layovers)) {
    stops = flightItem.layovers.length;
  } else {
    stops = Math.max((segments.length - 1), 0);
  }

  // 5. مدة الرحلة الإجمالية
  let durationStr = '0h 0m';
  const totalDuration = flightItem?.total_duration ?? flightItem?.duration;
  if (typeof totalDuration === 'number') {
    const hours = Math.floor(totalDuration / 60);
    const mins = totalDuration % 60;
    durationStr = `${hours}h ${mins}m`;
  }

  // 6. الأوقات (Deep Nested Extraction)
  const rawDepartureTime = 
    firstSegment?.departure_airport?.time ?? 
    firstSegment?.departure?.time ?? 
    firstSegment?.departure_time ??
    flightItem?.departure_airport?.time ??
    null;

  const rawArrivalTime = 
    lastSegment?.arrival_airport?.time ?? 
    lastSegment?.arrival?.time ?? 
    lastSegment?.arrival_time ??
    flightItem?.arrival_airport?.time ??
    null;

  // 7. رابط الحجز الاحتياطي
  let bookingLink = flightItem?.share_link ?? null;
  if (!bookingLink && flightItem?.booking_token) {
    bookingLink = `https://www.google.com/travel/flights/booking?tfs=${flightItem.booking_token}`;
  }
  
  return {
    airline: airlineName,
    airlineCode: airlineCode,
    price: formattedPrice, 
    rawPrice: rawPrice,
    stops: stops, 
    departure: formatTime(rawDepartureTime),
    arrival: formatTime(rawArrivalTime),
    origin: origin,
    destination: destination,
    duration: durationStr,
    link: bookingLink
  };
}

/**
 * [المنطق الهندسي]: حارس البيانات (Data Guard / Backend Filter).
 * يستبعد أي رحلات غير مكتملة (سعر صفر أو مفقود، وقت غير محدد).
 * يضمن وصول بيانات صالحة بنسبة 100% فقط للواجهة الأمامية.
 */
function filterValidFlights(flights: any[]) {
  return flights.filter(f => 
    f.rawPrice > 0 && 
    f.departure !== 'غير محدد' && 
    f.arrival !== 'غير محدد'
  );
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // إعدادات CORS
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

  if (!SERPAPI_KEY) {
    return res.status(500).json({ success: false, message: 'API key is not configured' });
  }

  try {
    console.log(`[GoogleFlights] Searching from ${origin} to ${destination} on ${date}`);
    
    const serpApiUrl = 'https://serpapi.com/search.json';
    
    // المطارات المحلية العراقية
    const iraqiAirports = ['BGW', 'EBL', 'ISU', 'BSR', 'NJF'];
    const isDomestic = iraqiAirports.includes(origin) && iraqiAirports.includes(destination);

    const params: any = {
      engine: 'google_flights',
      departure_id: origin,
      arrival_id: destination,
      outbound_date: date,
      type: '2', // ذهاب فقط
      currency: 'USD',
      hl: 'ar', 
      api_key: SERPAPI_KEY,
    };

    // فرض رحلات مباشرة فقط للرحلات الداخلية لمنع مسارات ترانزيت غير منطقية (مثل بغداد-عمان-بصرة)
    if (isDomestic) {
      params.stops = '1'; // 1 means non-stop in Google Flights SerpApi
    }

    const response = await axios.get(serpApiUrl, { params });
    const data = response.data;

    // دمج كافة نتائج الرحلات
    const rawFlights = [
      ...(data?.best_flights ?? []),
      ...(data?.other_flights ?? [])
    ];

    if (rawFlights.length === 0) {
       return res.json({ success: true, data: [] });
    }

    // 1. استخراج وتوحيد البيانات (Data Normalization)
    const mappedFlights = rawFlights.map(flightItem => 
      extractFlightData(flightItem, origin, destination, date)
    );

    // 2. تنظيف وتصفية البيانات قبل الإرسال (Backend Filtering)
    let validFlights = filterValidFlights(mappedFlights);

    if (isDomestic) {
      // السماح فقط للخطوط العراقية للرحلات الداخلية لضمان المصداقية
      const iraqiAirlines = ['IA', 'UR', 'IF'];
      validFlights = validFlights.filter(f => iraqiAirlines.includes(f.airlineCode) || f.airline.includes('Iraqi'));
    }

    // 3. إرسال البيانات النهائية الآمنة (Production-Ready Data)
    return res.json({ success: true, data: validFlights });

  } catch (error: any) {
    console.error('[GoogleFlights] Error:', error?.response?.data || error.message);
    return res.status(500).json({
      success: false,
      message: 'فشل في جلب البيانات من المصدر.',
      error: error?.response?.data?.error || error.message
    });
  }
}
