export interface ApiMessage {
  message: string;
}

export function apiMessage(message: string): ApiMessage {
  return { message };
}
