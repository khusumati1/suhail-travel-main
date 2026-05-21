import axios from 'axios';

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

  const { origin, destination, date } = req.body;

  if (!origin || !destination || !date) {
    res.status(400).json({ success: false, message: 'Missing required parameters' });
    return;
  }

  const apiKey = process.env.RAPIDAPI_KEY || '7abbfafd72msh45358856a4a02abp152323jsne3c3b4c13732';

  try {
    const response = await axios.get('https://google-flights2.p.rapidapi.com/api/v1/searchFlights', {
      params: {
        departure_id: origin,
        arrival_id: destination,
        outbound_date: date,
        travel_class: 'ECONOMY',
        adults: '1',
        currency: 'USD',
        language_code: 'en-US',
        country_code: 'US'
      },
      headers: {
        'x-rapidapi-host': 'google-flights2.p.rapidapi.com',
        'x-rapidapi-key': apiKey
      }
    });

    res.status(200).json({ success: true, data: response.data });
  } catch (error: any) {
    console.error('[API] Google Flights RapidAPI Error:', error.response?.data || error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch flights from RapidAPI',
      error: error.response?.data || error.message
    });
  }
}
