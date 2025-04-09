import { InputEvent } from 'acine-proto-dist';

/**
 * all ongoing streams
 */
const streams: Record<string, InputStream> = {};

/**
 * An input stream that collects events while it is open, then processes and
 * returns the result after it is complete.
 */
class InputStream {
  private active: Promise<void>; // blocks until stream is closed
  private completeCallback: () => void; // called to resolve this.active
  private events: InputEvent[] = [];
  readonly id: string = Date.now() + Math.random().toString(36).slice(2);
  constructor() {
    streams[this.id] = this;
    this.completeCallback = () => {}; // make typescript happy
    this.active = new Promise((resolve) => {
      this.completeCallback = resolve;
    });
  }

  /**
   * waits until .close is called
   */
  public async getContents(): Promise<InputEvent[]> {
    await this.active;
    return this.events;
  }

  /**
   * add event into the queue
   */
  public insert(event: InputEvent): void {
    this.events.push(event);
  }

  /**
   * closes the stream (no longer accepts events),
   * processes events then makes getContents return something
   */
  public close() {
    delete streams[this.id]; // disconnect
    this.events.sort((a, b) => a.timestamp - b.timestamp);

    // time alignment; only applies if there is at least 1 event
    if (this.events.length) {
      const t0 = this.events[0].timestamp;
      for (const event of this.events) {
        event.timestamp -= t0;
      }
    }

    this.completeCallback();
  }
}

export function open() {
  return new InputStream();
}

/**
 * Adds the event to all active events.
 *
 * This is a good enough way of tracking events since there shouldn't be many
 * ongoing event streams at any point in time.
 */
export function handleEvent(event: InputEvent) {
  for (const stream of Object.values(streams)) {
    stream.insert(event);
  }
}
