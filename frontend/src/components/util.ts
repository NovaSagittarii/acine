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

// https://stackoverflow.com/a/50159864
type Enum<E> = Record<keyof E, number | string> & { [k: number]: string };

/**
 * Reverse mapper function. Used for proto enum unmapping.
 * https://stackoverflow.com/a/66232780
 * https://stackoverflow.com/a/58448218
 */
export function getKey<T extends Enum<T>>(map: T, val: T[keyof T]) {
  return (Object.keys(map) as Array<keyof T>).find((key) => map[key] === val);
}
