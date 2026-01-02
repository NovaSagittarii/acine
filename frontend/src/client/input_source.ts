import { InputReplay, InputEvent } from 'acine-proto-dist';

/**
 * InputSource that you can submit an InputReplay and repeatedly
 * call some callback.
 *
 * TODO: possibly extend EventEmitter
 */
export default class InputSource {
  private timeout: null | number = null;
  private active: boolean = false;
  private onEvent: (event: InputEvent, dx: number, dy: number) => void;
  private onEnd: () => void = () => {};
  private startTime: number = 0;
  private endTime: number = 1;
  constructor(callback: (event: InputEvent) => void = () => {}) {
    this.onEvent = callback;
  }

  /**
   * starts a replay from InputReplay proto object.
   * automatically ends an ongoing replay (will interrupt).
   *
   * dx,dy is an offset applied to mouse position (default: 0,0)
   */
  public play(replay: InputReplay, dx: number = 0, dy: number = 0) {
    this.stop();
    this.active = true;
    const t0 = (this.startTime = Date.now());
    this.endTime =
      t0 +
      replay.events[replay.events.length - 1].timestamp -
      replay.events[0].timestamp;
    let i = 0;
    const next = () => {
      if (!this.active) return;
      const t = Date.now() - t0;
      if (i >= replay.events.length) {
        this.onEnd();
        return;
      }
      const future = replay.events[i].timestamp;
      setTimeout(() => {
        next(); // queue next event
        const event = replay.events[i++];
        // goes over by one (since next will fail first)
        if (event) this.onEvent(event, dx, dy);
      }, future - t);
    };
    next();
  }

  /**
   * ends the replay
   *
   * TODO: need to handle the case of auto release pressed mouse
   */
  public stop() {
    this.active = false;
    if (this.timeout !== null) clearTimeout(this.timeout);
    this.onEnd();
  }

  /**
   * @returns current progress in the range [0.0, 1.0]. -1 if not playing
   */
  public progress(): number {
    if (!this.active) return -1;
    return Math.min(
      1,
      (Date.now() - this.startTime) / (this.endTime - this.startTime),
    );
  }

  /**
   * budget addEventListener (does not allow multiple)
   */
  public setCallback(callback: (event: InputEvent) => void) {
    this.onEvent = callback;
  }

  /**
   * budget addEventListener (onEnd) (also does not allow multiple)
   */
  public setEndCallback(callback: () => void) {
    this.onEnd = callback;
  }
}
