import { describe, expect, it } from 'vitest';
import { parseTicketInput, parseTicketOutput, TICKET_MAX_BYTES } from '@shared/schemas';
import { defaultFlight, newTaskValues, valuesToPayload } from '@/components/task-wizard/values';
import type { SiteWithAirports } from '@/features/sites/queries';
import { applyTicketOption, matchPerson, nameTokens, readTicketMeta, ticketMediaType, ticketOptions } from '@/features/tasks/ticket';
import { airports, IDS, people, siteAirports, sites } from '@/mocks/fixtures';
import { mockParseTicket } from '@/mocks/ticket';

function siteWithAirports(id: string): SiteWithAirports {
  const site = sites.find((s) => s.id === id)!;
  const all = siteAirports.filter((sa) => sa.site_id === id).map((sa) => ({ ...sa, airport: airports.find((a) => a.id === sa.airport_id)! }));
  return {
    ...site,
    airports: all.filter((sa) => sa.is_active),
    allAirports: all,
    driverCount: 0,
    tasksToday: 0,
  };
}

describe('FR-18 ticket import', () => {
  it('normalises ticket and directory names to the same tokens', () => {
    expect(nameTokens('ALMUTAIRI/HAMAD MR')).toEqual(['almutairi', 'hamad']);
    expect(nameTokens('Mr. Hamad Al-Mutairi')).toEqual(['hamad', 'almutairi']);
    expect(nameTokens('AL OTAIBI/SARA MS')).toEqual(['alotaibi', 'sara']);
  });

  it('matches ticket passengers to staff, and leaves strangers unmatched', () => {
    expect(matchPerson('ALMUTAIRI/HAMAD MR', people)?.id).toBe(IDS.people.hamad);
    expect(matchPerson('ALOTAIBI/SARA MS', people)?.id).toBe(IDS.people.sara);
    expect(matchPerson('BAKER/JAMES MR', people)).toBeNull();
    // a first name alone is not enough
    expect(matchPerson('SARA', people)).toBeNull();
  });

  it('offers an arrival and a departure for a return ticket, site airports first', () => {
    const ticket = mockParseTicket();
    const rhq = siteWithAirports(IDS.sites.rhq);
    const options = ticketOptions(ticket, airports, rhq);
    // JED→RUH and RUH→JED: RUH arrival + RUH departure (site), JED departure + JED arrival (other)
    expect(options.map((o) => `${o.direction}:${o.iata}`)).toEqual(['arrival:RUH', 'departure:RUH', 'departure:JED', 'arrival:JED']);
    expect(options[0]).toMatchObject({ siteAirport: true, time: '14:55', terminal: '5', uncertain: [] });
    // the far end of the arrival is where it took off
    expect(options[0]!.other).toMatchObject({ iata: 'JED', time: '13:10', terminal: '1' });
    expect(options[1]!.uncertain).toEqual(['terminal']);
  });

  it('fills the flight card and takes the site airport buffer', () => {
    const rhq = siteWithAirports(IDS.sites.rhq);
    const [arrival] = ticketOptions(mockParseTicket(), airports, rhq);
    const current = { ...defaultFlight(rhq), buffer_min: 99, airline: 'kept' };
    const { flight, details } = applyTicketOption(arrival!, mockParseTicket(), current, rhq);
    expect(flight).toMatchObject({ airport_id: IDS.airports.ruh, direction: 'arrival', flight_no: 'SV 1023', airline: 'Saudia', time: '14:55', terminal: '5', buffer_min: 30 });
    expect(details).toMatchObject({ other_iata: 'JED', other_time: '13:10', other_terminal: '1', booking_ref: 'K7Q2XD', issuer: 'Al Tayyar Travel' });
    expect(details.tickets).toHaveLength(2);
  });

  it('still fills a flight whose airports are not set up in Masar, flagging the airport', () => {
    const ticket = { ...mockParseTicket(), segments: [{ ...mockParseTicket().segments[0]!, from_iata: 'LHR', to_iata: 'CDG' }] };
    const rhq = siteWithAirports(IDS.sites.rhq);
    const options = ticketOptions(ticket, airports, rhq);
    expect(options.map((o) => `${o.direction}:${o.iata}`)).toEqual(['departure:LHR', 'arrival:CDG']);
    expect(options[0]!.airport).toBeNull();
    expect(options[0]!.uncertain).toContain('airport_id');
    const current = defaultFlight(rhq);
    expect(applyTicketOption(options[0]!, ticket, current, rhq).flight).toMatchObject({ airport_id: current.airport_id, flight_no: 'SV 1023' });
  });

  it('round-trips the ticket details through task metadata', () => {
    const rhq = siteWithAirports(IDS.sites.rhq);
    const [arrival] = ticketOptions(mockParseTicket(), airports, rhq);
    const values = newTaskValues('airport', rhq);
    const { flight, details } = applyTicketOption(arrival!, mockParseTicket(), values.flight!, rhq);
    const payload = valuesToPayload({ ...values, title: 'RUH pickup', flight, ticket: details }, { arrivals: [], distanceKm: 0 } as never, []);
    expect(readTicketMeta(payload.metadata)).toMatchObject({ other: { iata: 'JED', time: '13:10' }, booking_ref: 'K7Q2XD' });
    // no ticket → metadata.ticket cleared
    expect(valuesToPayload(values, { arrivals: [], distanceKm: 0 } as never, []).metadata).toEqual({ ticket: null });
  });

  it('validates the contract and the file', () => {
    expect(parseTicketOutput.safeParse(mockParseTicket()).success).toBe(true);
    expect(parseTicketInput.safeParse({ media_type: 'application/msword', data: 'x' }).success).toBe(false);
    expect(ticketMediaType(new File(['%PDF'], 'ticket.PDF', { type: '' }))).toBe('application/pdf');
    expect(() => ticketMediaType(new File(['x'], 'ticket.docx', { type: 'application/msword' }))).toThrow();
    const big = new File([new Uint8Array(TICKET_MAX_BYTES + 1)], 'big.pdf', { type: 'application/pdf' });
    expect(() => ticketMediaType(big)).toThrow();
  });
});
