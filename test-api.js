const axios = require('axios');

async function testApi() {
  try {
    const res = await axios.get('https://aviation-edge.com/v2/public/flightsFuture', {
      params: {
        key: 'dafa94-4486e5',
        iataCode: 'BGW', // Baghdad
        type: 'departure',
        date: '2026-06-01'
      }
    });
    console.log(JSON.stringify(res.data.slice(0, 2), null, 2));
  } catch (e) {
    console.error(e.response ? e.response.data : e.message);
  }
}

testApi();
