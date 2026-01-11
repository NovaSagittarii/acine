import { DispatchWithoutAction, useReducer } from 'react';

export interface ExtendsForceUpdateScope {
  overrideForceUpdate?: ReturnType<typeof useForceUpdate>;
}

// from https://stackoverflow.com/a/53837442
// https://legacy.reactjs.org/docs/hooks-faq.html#is-there-something-like-forceupdate
export default function useForceUpdate(
  overrideForceUpdateScope?: DispatchWithoutAction,
) {
  const [_, forceUpdate] = useReducer((x) => x + 1, 0);

  // written this way so initial useForceUpdate is always called (rules of hooks)
  // see https://legacy.reactjs.org/docs/hooks-rules.html#explanation
  if (overrideForceUpdateScope) return overrideForceUpdateScope;

  return forceUpdate;
}
