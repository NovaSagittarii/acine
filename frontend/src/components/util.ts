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
