export type TicketPricing = {
  label: string;
  value: string;
};

export interface EventSummary {
  eventId: string;
  title: string;
  category: string;
  startDate: string;
  startTime: string;
  venue: string;
  imageUrl: string;
  ticketType: string;
  ticketPrices?: TicketPricing[];
  favorite?: boolean;
}

