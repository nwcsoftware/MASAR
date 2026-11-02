/**
 * Stand-in for the `ai-suggest-airports` Edge Function (FR-03) in demo mode:
 * a small catalogue of Saudi airports ranked by distance from the site.
 */
export interface AirportSuggestion {
  iata: string;
  icao: string;
  name: string;
  name_ar: string;
  city: string;
  city_ar: string;
  lat: number;
  lng: number;
  is_international: boolean;
}

export const AIRPORT_CATALOGUE: AirportSuggestion[] = [
  { iata: 'RUH', icao: 'OERK', name: 'King Khalid International Airport', name_ar: 'مطار الملك خالد الدولي', city: 'Riyadh', city_ar: 'الرياض', lat: 24.9576, lng: 46.6988, is_international: true },
  { iata: 'DMM', icao: 'OEDF', name: 'King Fahd International Airport', name_ar: 'مطار الملك فهد الدولي', city: 'Dammam', city_ar: 'الدمام', lat: 26.4712, lng: 49.7979, is_international: true },
  { iata: 'JED', icao: 'OEJN', name: 'King Abdulaziz International Airport', name_ar: 'مطار الملك عبدالعزيز الدولي', city: 'Jeddah', city_ar: 'جدة', lat: 21.6796, lng: 39.1565, is_international: true },
  { iata: 'MED', icao: 'OEMA', name: 'Prince Mohammad bin Abdulaziz Airport', name_ar: 'مطار الأمير محمد بن عبدالعزيز', city: 'Madinah', city_ar: 'المدينة المنورة', lat: 24.5534, lng: 39.705, is_international: true },
  { iata: 'TIF', icao: 'OETF', name: 'Taif International Airport', name_ar: 'مطار الطائف الدولي', city: 'Taif', city_ar: 'الطائف', lat: 21.4834, lng: 40.5443, is_international: true },
  { iata: 'AHB', icao: 'OEAB', name: 'Abha International Airport', name_ar: 'مطار أبها الدولي', city: 'Abha', city_ar: 'أبها', lat: 18.2404, lng: 42.6566, is_international: true },
  { iata: 'HOF', icao: 'OEAH', name: 'Al-Ahsa International Airport', name_ar: 'مطار الأحساء الدولي', city: 'Hofuf', city_ar: 'الهفوف', lat: 25.2853, lng: 49.4852, is_international: true },
  { iata: 'ELQ', icao: 'OEGS', name: 'Prince Nayef bin Abdulaziz Airport', name_ar: 'مطار الأمير نايف بن عبدالعزيز', city: 'Qassim', city_ar: 'القصيم', lat: 26.3028, lng: 43.7744, is_international: true },
  { iata: 'TUU', icao: 'OETB', name: 'Prince Sultan bin Abdulaziz Airport', name_ar: 'مطار الأمير سلطان بن عبدالعزيز', city: 'Tabuk', city_ar: 'تبوك', lat: 28.3654, lng: 36.6189, is_international: true },
  { iata: 'GIZ', icao: 'OEGN', name: 'King Abdullah bin Abdulaziz Airport', name_ar: 'مطار الملك عبدالله بن عبدالعزيز', city: 'Jazan', city_ar: 'جازان', lat: 16.9011, lng: 42.5858, is_international: true },
];
