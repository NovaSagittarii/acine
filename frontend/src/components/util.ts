export { v4 as uuidv4 } from 'uuid';

type Generates<T> = () => T;

interface GeneratorDescription<T, C> {
  name: keyof C;
  method: Generates<T>;
}

export function exportGenerator<T, C>(
  generatorClass: C,
  methods: Exclude<keyof C, 'prototype'>[],
): GeneratorDescription<T, C>[] {
  return methods.map(
    (x) =>
      ({ name: x, method: generatorClass[x] }) as GeneratorDescription<T, C>,
  );
}

/**
 * Reverse mapper function. Used for proto enum unmapping.
 * https://stackoverflow.com/a/66232780
 * https://stackoverflow.com/a/58448218
 */
export function getKey<V, T extends Record<any, V>>(map: T, val: V) {
  return Object.keys(map).find((key) => map[key] === val);
}
