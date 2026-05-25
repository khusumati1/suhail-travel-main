// src/services/flightService.ts
import axios from 'axios';

class FlightService {
  async initSearch(payload: any): Promise<any> {
    console.log('[FlightService] Flight search initiated');

    const response = await axios.post('/api/search-flights', {
      origin: payload.origin,
      destination: payload.destination,
      date: payload.departure_date || payload.date
    });

    return {
      status: 'completed',
      offers: response.data.data?.flights || response.data.data || []
    };
  }

  async searchFlights(params: any) {
    return this.initSearch({
      origin: params.origin,
      destination: params.destination,
      departure_date: params.departure_date
    });
  }
}

export const flightService = new FlightService();
