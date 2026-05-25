import axios from 'axios';

export default async function handler(req: any, res: any) {
  // CORS Headers
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

  const { cityName, checkIn, checkOut, adultsCount = 2 } = req.body;

  if (!cityName || !checkIn || !checkOut) {
    return res.status(400).json({ 
      success: false, 
      message: 'Missing required parameters: cityName, checkIn, checkOut' 
    });
  }

  const apiEndpoint = process.env.HOTELS_API_ENDPOINT;
  const apiKey = process.env.HOTELS_API_KEY;

  if (!apiEndpoint) {
    return res.status(500).json({ 
      success: false, 
      message: 'API endpoint not configured. Set HOTELS_API_ENDPOINT environment variable.' 
    });
  }

  try {
    const response = await axios.post(apiEndpoint, {
      cityName,
      checkIn,
      checkOut,
      adultsCount
    }, {
      headers: apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {},
      timeout: 30000
    });

    res.status(200).json({ success: true, data: response.data });
  } catch (error: any) {
    console.error('[API] Hotel search error:', error.message);
    res.status(error.response?.status || 500).json({ 
      success: false, 
      message: error.response?.data?.message || 'Failed to fetch hotels from API'
    });
  }
}
