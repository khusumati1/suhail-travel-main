import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';

// مفتاح SerpApi المحقون من متغيرات البيئة
const SERPAPI_KEY = process.env.VITE_SERPAPI_API_KEY || process.env.SERPAPI_API_KEY;

/**
 * دالة مساعدة لتنسيق الوقت بصيغة مفهومة محلياً (مثال: 10:30 م)
 * @param timeString النص القادم من API
 */
function formatTime(timeString: string | null | undefined): string {
  if (!timeString) return 'غير محدد';
  
  try {
    // بعض توقيتات SerpApi تأتي بصيغة "2024-06-15 10:00 AM"
    // أو كنص عادي يمثل الساعة. نحاول تحويله أولاً:
    const dateObj = new Date(timeString);
    if (!isNaN(dateObj.getTime())) {
      // إذا كان تاريخاً صالحاً، نحوله بتوقيت العراق/عربي
      return dateObj.toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' });
    }
  } catch (e) {
    // تجاهل أخطاء التحويل
  }
  
  // إذا فشل التحويل (مثلاً النص كان "10:00 AM" فقط)، نعيده كما هو
  return timeString;
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
    const params = {
      engine: 'google_flights',
      departure_id: origin,
      arrival_id: destination,
      outbound_date: date,
      type: '2', // 2 = رحلة ذهاب فقط لتجنب الأخطاء
      currency: 'USD',
      hl: 'ar', 
      api_key: SERPAPI_KEY,
    };

    const response = await axios.get(serpApiUrl, { params });
    const data = response.data;

    // دمج أفضل الرحلات والرحلات الأخرى
    const rawFlights = [
      ...(data?.best_flights ?? []),
      ...(data?.other_flights ?? [])
    ];

    if (rawFlights.length === 0) {
       return res.json({ success: true, data: [] });
    }

    // Mapping: استخراج البيانات العميقة باستراتيجية (Fall-through)
    const mappedFlights = rawFlights.map((flightItem: any) => {
      
      // 1. استخراج مقاطع الرحلة (Segments) بمسارات بديلة
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
      
      // 3. السعر (التعامل مع الأسعار بالآلاف)
      let price = flightItem?.price ?? 0;
      if (price > 0 && price < 1000) {
        price = price * 1000; // تحويل السعر الصغير (مثل 217) إلى (217000)
      }
      
      // 4. محطات التوقف (Stops)
      // نعتمد على layovers إن وجدت، وإلا نحسب من المقاطع لضمان عدم وجود undefined
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

      // 6. الأوقات (المغادرة والوصول) باستراتيجية مسارات متعددة
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

      const departureTime = formatTime(rawDepartureTime);
      const arrivalTime = formatTime(rawArrivalTime);

      // 7. رابط الحجز (Booking Link)
      let bookingLink = flightItem?.share_link ?? null;
      if (!bookingLink && flightItem?.booking_token) {
        bookingLink = `https://www.google.com/travel/flights/booking?tfs=${flightItem.booking_token}`;
      }
      const fallbackLink = `https://www.google.com/travel/flights?q=Flights+from+${origin}+to+${destination}+on+${date}`;
      
      return {
        airline: airlineName,
        airlineCode: airlineCode,
        price: price,
        stops: stops, // سيعود كرقم دائماً ولن يكون undefined
        departure: departureTime,
        arrival: arrivalTime,
        duration: durationStr,
        link: bookingLink ?? fallbackLink
      };
    });

    // Data Validation & Guard Clause: الفلترة الذكية للرحلات قبل إرسالها للواجهة
    // نستبعد الرحلات الوهمية أو التي سعرها 0 أو الأوقات المفقودة تماماً
    const validFlights = mappedFlights.filter(f => 
      f.price > 0 && 
      f.departure !== 'غير محدد' && 
      f.arrival !== 'غير محدد'
    );

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
