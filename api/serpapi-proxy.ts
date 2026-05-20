// api/serpapi-proxy.ts
// Vercel Serverless Function — proxies SerpAPI calls to avoid CORS in production
// Deployed automatically by Vercel at: https://your-domain.vercel.app/api/serpapi-proxy

import type { VercelRequest, VercelResponse } from '@vercel/node';
import https from 'https';
import { URL } from 'url';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Forward all query params to SerpAPI
    const queryParams = new URLSearchParams();

    for (const [key, value] of Object.entries(req.query)) {
      if (Array.isArray(value)) {
        value.forEach(v => queryParams.append(key, v));
      } else if (value !== undefined) {
        queryParams.append(key, value as string);
      }
    }

    // Inject the server-side API key (never exposed to client)
    const apiKey = process.env.SERPAPI_API_KEY || process.env.VITE_SERPAPI_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ error: 'Search engine not configured on this server.' });
    }

    // Override the api_key from query to use server-side env variable
    queryParams.set('api_key', apiKey);

    const serpApiUrl = `https://serpapi.com/search.json?${queryParams.toString()}`;

    console.log(`[SerpAPI Proxy] Forwarding request to SerpAPI: ${queryParams.get('engine')} | ${queryParams.get('departure_id')} → ${queryParams.get('arrival_id')}`);

    // Fetch from SerpAPI
    const serpResponse = await fetchUrl(serpApiUrl);

    // Set CORS headers for the client
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');
    res.status(serpResponse.statusCode || 200).send(serpResponse.body);

  } catch (error: any) {
    console.error('[SerpAPI Proxy] Error:', error.message);
    res.status(502).json({
      error: 'Bad Gateway: Failed to connect to search engine.',
      details: error.message
    });
  }
}

// Helper: fetch a URL using Node's built-in https (no extra dependencies)
function fetchUrl(url: string): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      path:     parsedUrl.pathname + parsedUrl.search,
      method:   'GET',
      headers: {
        'User-Agent': 'SuhailTravel/1.0',
      },
    };

    const request = https.request(options, (response) => {
      let body = '';
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => {
        resolve({ statusCode: response.statusCode || 200, body });
      });
    });

    request.on('error', reject);
    request.setTimeout(15000, () => {
      request.destroy();
      reject(new Error('Request timeout after 15s'));
    });
    request.end();
  });
}
