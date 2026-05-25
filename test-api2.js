const axios = require('axios');

async function testApi() {
  try {
    const res = await axios.get('https://aviation-edge.com/v2/public/flightsFuture', {
      params: {
        key: 'dafa94-4486e5',
        iataCode: 'BGW',
        type: 'departure',
        date: '2026-05-30'
      }
    });
    console.log("Success! Data:", res.data.slice ? res.data.slice(0, 1) : res.data);
  } catch (e) {
    console.log("Error status:", e.response ? e.response.status : e.message);
  }
}

testApi();
