import { useState } from 'react';

// from https://stackoverflow.com/a/53837442
export default function useForceUpdate() {
  const [, setValue] = useState(0);
  return () => setValue((value) => value + 1);
}
