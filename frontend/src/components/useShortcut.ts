import { Dispatch, SetStateAction, useEffect, useState } from 'react';

interface Binding {
  onKeyDown: (event: KeyboardEvent) => void;
  onKeyUp: (event: KeyboardEvent) => void;
  setActive: Dispatch<SetStateAction<boolean>>;
}

const bindings: Record<string, Array<Binding>> = {};
function push(
  key: KeyCode,
  onKeyDown: (event: KeyboardEvent) => void,
  onKeyUp: (event: KeyboardEvent) => void,
  setActive: Dispatch<SetStateAction<boolean>>,
) {
  // console.log("push", key);
  if (!bindings[key]) bindings[key] = [];
  const binding = bindings[key];
  if (binding.length) binding[binding.length - 1].setActive(false);
  binding.push({ onKeyDown, onKeyUp, setActive });
}
function pop(key: KeyCode) {
  // console.log("pop", key);
  const binding = bindings[key];
  console.assert(binding, `Invalid pop on ${key}, binding does not exist.`);
  console.assert(binding[0], `Invalid pop on ${key}, binding is empty.`);
  binding.pop()?.setActive(false);
  if (binding[0]) binding[binding.length - 1].setActive(true);
}

export function setupShortcuts() {
  // setup listener
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      // console.log(event.code, bindings);
      const binding = bindings[event.code];
      if (binding && binding[0]) binding[binding.length - 1].onKeyDown(event);
      if (event.code !== 'Tab') event.preventDefault();
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      // console.log(event.code, bindings);
      const binding = bindings[event.code];
      if (binding && binding[0]) binding[binding.length - 1].onKeyUp(event);
      if (event.code !== 'Tab') event.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  });
}

/**
 * Pushes a callback onto the callback stack for the specific key.
 * @param key which key to listen on
 * @param onKeyDown what to call when keydown is triggered
 * @param onKeyUp what to call when keyup is triggered
 * @returns whether the keybind is active or not (useState), and teardown
 */
export default function useShortcut(
  key: KeyCode,
  onKeyDown: (event: KeyboardEvent) => void,
  onKeyUp: (event: KeyboardEvent) => void = () => {},
): [boolean, () => void] {
  const [isActive, setActive] = useState(true);
  let popped = false;
  const _pop = () => {
    if (popped) return;
    popped = true;
    pop(key);
  };
  useEffect(() => {
    push(key, onKeyDown, onKeyUp, setActive);
    return _pop;
  }, []);
  return [isActive, _pop];
}

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
  | 'CapsLock';
