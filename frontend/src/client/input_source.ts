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
  private onEvent: (event: InputEvent) => void;
  constructor(callback: (event: InputEvent) => void = () => {}) {
    this.onEvent = callback;
  }

  /**
   * starts a replay from InputReplay proto object.
   * automatically ends an ongoing replay (will interrupt).
   */
  public play(replay: InputReplay) {
    this.stop();
    this.active = true;
    const t0 = Date.now();
    let i = 0;
    const next = () => {
      if (!this.active) return;
      const t = Date.now() - t0;
      if (i >= replay.events.length) {
        return;
      }
      const future = replay.events[i].timestamp;
      setTimeout(() => {
        next();
        this.onEvent(replay.events[i++]);
      }, future - t);
    };
    next();
  }

  /**
   * ends the replay
   */
  public stop() {
    this.active = false;
    if (this.timeout !== null) clearTimeout(this.timeout);
  }

  /**
   * budget addEventListener (does not allow multiple)
   */
  public setCallback(callback: (event: InputEvent) => void) {
    this.onEvent = callback;
  }
}
