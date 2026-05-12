import WebSocket from "ws";

export const clients = new Set<WebSocket>();

export function broadcast(payload: string) {
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}
