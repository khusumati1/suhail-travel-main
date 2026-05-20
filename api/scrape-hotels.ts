import axios from 'axios';
import * as cheerio from 'cheerio';

// ZENROWS API Key removed
// const ZENROWS_API_KEY = process.env.ZENROWS_API_KEY;

export default async function handler(req: any, res: any) {
  // 1. CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ success: false, message: 'Method Not Allowed' });
    return;
  }

  const { cityName, cityId, checkIn, checkOut, adultsCount = 2 } = req.body;

  // Resolve cityId if missing
  let targetId = cityId;
  if (!targetId || targetId <= 0) {
    if (cityName.toLowerCase().includes('baghdad') || cityName.includes('بغداد')) targetId = 3483;
    else if (cityName.toLowerCase().includes('erbil') || cityName.includes('اربيل')) targetId = 3482;
    else targetId = 3484; // Basra fallback
  }

  const fCheckIn = checkIn.split('T')[0];
  const fCheckOut = checkOut.split('T')[0];
  const slug = `${cityName}-${targetId}`;
  
  const searchUrl = `https://sindibad.iq/hotels/${slug}?cityNameLocale=${encodeURIComponent(cityName)}&country=Iraq&checkIn=${fCheckIn}&checkOut=${fCheckOut}&countryId=17&searchType=City&rooms=${adultsCount}`;

  console.log(`[Vercel Serverless] 🚀 Mission Start: ${cityName}`);
  
  // Scraper disabled to ensure scrape-iran-flights is the only external scraper
  console.log(`[Hotels] Hotel scraping is temporarily disabled.`);

  try {
    // Return empty list instead of scraping
    res.status(200).json({ success: true, data: [], count: 0 });
    
  } catch (error: any) {
    console.error(`[Vercel Serverless] ❌ Mission FAILED: ${error.message}`);
    // Return 504 on timeout
    res.status(504).json({ 
      success: false, 
      message: "Search taking longer than expected, please try again." 
    });
  }
}
