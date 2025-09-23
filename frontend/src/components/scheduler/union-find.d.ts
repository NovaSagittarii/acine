declare module '@manubb/union-find' {
  export interface UnionFindElement {
    rank: number;
    parent: UnionFindElement;
  }
  export function makeSet<T>(): UnionFindElement & T;
  export function find<T>(u: UnionFindElement & T): UnionFindElement & T;
  export function union<T>(
    u: UnionFindElement & T,
    v: UnionFindElement & T,
  ): void;
}
