import { api } from './api';

export type SupportTicket = {
  id: string;
  subject: string;
  category: string;
  status: string;
  tripId: string | null;
  createdAt: string;
  updatedAt: string;
  messages?: SupportMessage[];
};

export type SupportMessage = {
  id: string;
  authorId: string;
  body: string;
  createdAt: string;
};

export async function listSupportTickets() {
  const { data } = await api.get<{ tickets: SupportTicket[] }>('/rider/support');
  return data.tickets;
}

export async function createSupportTicket(input: {
  subject: string;
  category?: string;
  body: string;
  tripId?: string;
}) {
  const { data } = await api.post<{ ticket: SupportTicket }>('/rider/support', input);
  return data.ticket;
}

export async function getSupportTicket(id: string) {
  const { data } = await api.get<{ ticket: SupportTicket }>(`/rider/support/${id}`);
  return data.ticket;
}

export async function sendSupportMessage(id: string, body: string) {
  const { data } = await api.post<{ ticket: SupportTicket }>(`/rider/support/${id}/messages`, { body });
  return data.ticket;
}
