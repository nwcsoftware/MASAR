/**
 * Stand-in for the `ai-parse-ticket` Edge Function (FR-18) in demo mode
 * when the dev server has no ANTHROPIC_API_KEY (the UI says the file was not
 * read): a Jeddah ⇄ Riyadh return trip for Hamad Al-Mutairi (in the staff
 * directory) and a visitor who is not.
 */
import type { ParseTicketOutput } from '@shared/schemas';
import { companyDateKey } from '@/lib/format';

const day = (offset: number) => companyDateKey(new Date(Date.now() + offset * 86_400_000));

export function mockParseTicket(): ParseTicketOutput {
  return {
    booking_ref: 'K7Q2XD',
    issuer: 'Al Tayyar Travel',
    passengers: [
      { name: 'ALMUTAIRI/HAMAD MR', ticket_no: '065 2401234567' },
      { name: 'BAKER/JAMES MR', ticket_no: '065 2401234568' },
    ],
    segments: [
      {
        flight_no: 'SV 1023',
        airline: 'Saudia',
        from_iata: 'JED',
        to_iata: 'RUH',
        from_name: 'Jeddah King Abdulaziz Intl',
        to_name: 'Riyadh King Khalid Intl',
        departure_date: day(1),
        departure_time: '13:10',
        arrival_date: day(1),
        arrival_time: '14:55',
        departure_terminal: '1',
        arrival_terminal: '5',
        uncertain: [],
      },
      {
        flight_no: 'SV 1030',
        airline: 'Saudia',
        from_iata: 'RUH',
        to_iata: 'JED',
        from_name: 'Riyadh King Khalid Intl',
        to_name: 'Jeddah King Abdulaziz Intl',
        departure_date: day(4),
        departure_time: '18:40',
        arrival_date: day(4),
        arrival_time: '20:25',
        departure_terminal: '5',
        arrival_terminal: null,
        uncertain: ['terminal'],
      },
    ],
  };
}
