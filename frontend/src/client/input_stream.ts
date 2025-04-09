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
  public close({ noHover = false }: InputStream.CloseOptions = {}) {
    delete streams[this.id]; // disconnect
    this.events.sort((a, b) => a.timestamp - b.timestamp);

    if (noHover) {
      const flag: boolean[] = [];
      let ok = false;
      for (const e of this.events) {
        if (e.type?.$case === 'mouseDown') ok = true;
        else if (e.type?.$case === 'mouseUp') ok = false;
        flag.push(ok);
      }
      this.events = this.events.filter(
        (e, i) => e.type?.$case !== 'move' || flag[i],
      );
    }

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

namespace InputStream {
  /**
   * Various input event stream post-processing options.
   */
  export interface CloseOptions {
    /**
     * Removes mousemove events that happen while the mouse is up.
     *
     * Useful for mobile games which only have tap and drag.
     */
    noHover?: boolean;

    /**
     * NOT IMPLEMENTED
     *
     * Removes mousemove events that happen before the first mousedown
     * and after the last mouseup.
     *
     * Used to clean up artifact from mouse move as a result of
     * moving from [Record Start] -> (recording ...) -> [Record End]
     */
    stripMove?: boolean;
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
export function handleInputEvent(event: InputEvent) {
  for (const stream of Object.values(streams)) {
    stream.insert(event);
  }
}
