/**
 * currently unused since it is messy to attach events;
 * maybe use a library for persistent ws instead...
 */

import { sleep } from './util';

type StopPersistentConnectCallback = () => void;

class ServerWS {
  ws: WebSocket | null = null;
  url: string;

  constructor(url: string) {
    this.url = url;
  }

  // returns when the connection ends
  // returns true when there is an error during connection
  async connect(): Promise<boolean> {
    return new Promise((res) => {
      try {
        this.ws = new WebSocket(this.url);
        this.ws.addEventListener('close', () => res(false));
      } catch {
        console.warn(`failed to connect to ${this.url}`);
        res(true);
      }
    });
  }

  startPersistentConnection(
    reconnectInterval: number = 1000,
  ): StopPersistentConnectCallback {
    let keepAlive = true;
    const stop = () => {
      keepAlive = false;
      this.ws?.close();
    };
    const persist = async () => {
      while (keepAlive) {
        if (await this.connect()) {
          await sleep(reconnectInterval);
        }
      }
    };
    persist();
    return stop;
  }
}

export default ServerWS;
