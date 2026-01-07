import { atom } from 'nanostores';
import { Dispatch, SetStateAction, useEffect, useState } from 'react';

export const $bindings = atom<Record<string, Binding | undefined>>({});
const keydown = new Set<string>();

export enum ShortcutType {
  /**
   * callbacks called on keydown and keyup.
   * note that the key might be already down, then the event won't trigger
   */
  ON_PRESS = 1,
  /**
   * callbacks called on keydown and keyup and possibly on component render/destroy
   * - if the key is down on render, keydown is called
   * - if the key is down on destroy, keyup is called
   */
  WHILE_PRESSED = 2,
}

interface Binding {
  type: ShortcutType;
  /** Description of the shortcut (used in indicator text). */
  label: string;
  /** Callback called when key is down. */
  onKeyDown: (event?: KeyboardEvent) => void;
  /** Callback called when key is up. */
  onKeyUp: (event?: KeyboardEvent) => void;
  /** Callback to call to update active state (push/pop). */
  setActive: Dispatch<SetStateAction<boolean>>;
  /** whether to hide on the shortcut bindings display or not */
  hidden: boolean;
}

const bindings: Record<string, Array<Binding>> = {};
function push(
  key: KeyCode,
  { type, label, onKeyDown, onKeyUp, setActive, hidden }: Binding,
) {
  // console.log("push", key);
  if (!bindings[key]) bindings[key] = [];
  const binding = bindings[key];
  if (type === ShortcutType.WHILE_PRESSED && keydown.has(key)) {
    onKeyDown(undefined);
  }
  if (binding.length) binding[binding.length - 1].setActive(false);
  binding.push({ type, label, onKeyDown, onKeyUp, setActive, hidden });
  $bindings.set({ ...$bindings.get(), [key]: binding[binding.length - 1] });
}
function pop(key: KeyCode) {
  // console.log("pop", key);
  const binding = bindings[key];
  console.assert(binding, `Invalid pop on ${key}, binding does not exist.`);
  console.assert(binding[0], `Invalid pop on ${key}, binding is empty.`);
  const removed = binding.pop()!;
  if (removed.type === ShortcutType.WHILE_PRESSED && keydown.has(key)) {
    removed.onKeyUp(undefined);
  }
  removed?.setActive(false);
  if (binding[0]) binding[binding.length - 1].setActive(true);
  $bindings.set({
    ...$bindings.get(),
    [key]: binding[0] && binding[binding.length - 1],
  });
}

// returns True if this is on input/textarea element
function checkSuppressBinding(event: KeyboardEvent): boolean {
  if (
    (['INPUT', 'TEXTAREA'] as any[]).includes((event.target as any).tagName)
  ) {
    return true;
  }
  return false;
}

export function useSetupShortcuts() {
  // setup listener
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (checkSuppressBinding(event)) return;
      keydown.add(event.code);
      // console.log(event.code, bindings);
      const binding = bindings[event.code];
      if (binding && binding[0]) {
        binding[binding.length - 1].onKeyDown(event);
        event.preventDefault();
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (checkSuppressBinding(event)) return;
      keydown.delete(event.code);
      // console.log(event.code, bindings);
      const binding = bindings[event.code];
      if (binding && binding[0]) {
        binding[binding.length - 1].onKeyUp(event);
        event.preventDefault();
      }
    };
    const onBlur = () => {
      // document lost focus, thus the key is no longer held
      // such as when tabbing out (when returning, the keyup is not triggered)
      for (const key in bindings) {
        for (const { type, onKeyUp } of bindings[key]) {
          if (type === ShortcutType.WHILE_PRESSED && keydown.has(key)) {
            onKeyUp(undefined);
          }
        }
      }
      keydown.clear();
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  });
}

/**
 * Pushes a callback onto the callback stack for the specific key.
 *
 * onKeyUp is called with undefined event when the component is deleted
 * while the key is held down (used for shortcuts that apply while key is down)
 *
 * @param key which key to listen on
 * @param onKeyDown what to call when keydown is triggered
 * @param onKeyUp what to call when keyup is triggered
 * @returns whether the keybind is active or not (useState)
 */
export default function useShortcut(
  key: KeyCode | null | false,
  {
    label, // required for accessibility
    type = ShortcutType.ON_PRESS,
    onKeyDown = () => {},
    onKeyUp = () => {},
    hidden = false,
  }: Pick<Binding, 'label'> & Partial<Omit<Binding, 'label'>>,
): boolean {
  const [isActive, setActive] = useState(true);
  useEffect(() => {
    if (key) {
      push(key, { type, label, onKeyDown, onKeyUp, setActive, hidden });
      return () => pop(key);
    }
    return () => {};
  }, [label, key, onKeyDown, onKeyUp, hidden]);
  return isActive;
}

export const FKeys: KeyCode[] = [
  'F1',
  'F2',
  'F3',
  'F4',
  'F5',
  'F6',
  'F7',
  'F8',
  'F9',
  'F10',
];

export const DigitKeys: KeyCode[] = [
  'Digit1',
  'Digit2',
  'Digit3',
  'Digit4',
  'Digit5',
  'Digit6',
  'Digit7',
  'Digit8',
  'Digit9',
  'Digit0',
];

/**
 * Common key codes
 * from https://developer.mozilla.org/en-US/docs/Web/API/UI_Events/Keyboard_event_code_values#code_values_on_windows
 */
export type KeyCode =
  | 'Unidentified'
  | 'Escape'
  | 'Digit1'
  | 'Digit2'
  | 'Digit3'
  | 'Digit4'
  | 'Digit5'
  | 'Digit6'
  | 'Digit7'
  | 'Digit8'
  | 'Digit9'
  | 'Digit0'
  | 'Minus'
  | 'Equal'
  | 'Backspace'
  | 'Tab'
  | 'KeyQ'
  | 'KeyW'
  | 'KeyE'
  | 'KeyR'
  | 'KeyT'
  | 'KeyY'
  | 'KeyU'
  | 'KeyI'
  | 'KeyO'
  | 'KeyP'
  | 'BracketLeft'
  | 'BracketRight'
  | 'Enter'
  | 'ControlLeft'
  | 'KeyA'
  | 'KeyS'
  | 'KeyD'
  | 'KeyF'
  | 'KeyG'
  | 'KeyH'
  | 'KeyJ'
  | 'KeyK'
  | 'KeyL'
  | 'Semicolon'
  | 'Quote'
  | 'Backquote'
  | 'ShiftLeft'
  | 'Backslash'
  | 'KeyZ'
  | 'KeyX'
  | 'KeyC'
  | 'KeyV'
  | 'KeyB'
  | 'KeyN'
  | 'KeyM'
  | 'Comma'
  | 'Period'
  | 'Slash'
  | 'ShiftRight'
  | 'NumpadMultiply'
  | 'AltLeft'
  | 'Space'
  | 'CapsLock'
  | 'F1'
  | 'F2'
  | 'F3'
  | 'F4'
  | 'F5'
  | 'F6'
  | 'F7'
  | 'F8'
  | 'F9'
  | 'F10'
  | 'Delete'
  | 'Unidentified'; // trailing dummy value
