import { useReducer } from 'react';

// from https://stackoverflow.com/a/53837442
// https://legacy.reactjs.org/docs/hooks-faq.html#is-there-something-like-forceupdate
export default function useForceUpdate() {
  const [_, forceUpdate] = useReducer((x) => x + 1, 0);
  return forceUpdate;
}
