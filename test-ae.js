const axios = require('axios');

async function testAE() {
  try {
    const res = await axios.get('https://aviation-edge.com/v2/public/timetable', {
      params: {
        key: 'dafa94-4486e5',
        iataCode: 'BGW',
        type: 'departure'
      }
    });
    console.log("Timetable Success:", res.data[0]);
  } catch (e) {
    console.log("Timetable Error:", e?.response?.data || e.message);
  }
}

testAE();
