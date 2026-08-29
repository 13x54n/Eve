import { api } from './api';

export const DEFAULT_GREETING_TEMPLATE = 'Nice to see you, {name}';

export async function getGreetingTemplate() {
  const { data } = await api.get<{ template: string }>('/rider/greeting');
  return data.template || DEFAULT_GREETING_TEMPLATE;
}

export function firstName(name: string | null | undefined) {
  const token = name?.trim().split(/\s+/)[0];
  return token || 'there';
}

export function interpolateGreeting(template: string, name: string | null | undefined) {
  return template.replaceAll('{name}', firstName(name));
}
