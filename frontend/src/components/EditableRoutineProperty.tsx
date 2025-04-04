import { useStore } from '@nanostores/react';

import { $routine } from '../state';
import EditableText from './EditableText';

interface EditableRoutinePropertyProps<T, K extends keyof T> {
  object: T;
  property: K;
  className?: string;
}

/**
 * For editing text properties of `$routine`. Shorthand for
 *
 * ```tsx
 * <EditableText
 *   onChange={(s) => {
 *     object[property] = s;
 *     $routine.set(routine);
 *   }}
 * >
 *   {object[property]}
 * </EditableText>
 * ```
 */
export default function EditableRoutineProperty<T, K extends keyof T>({
  object,
  property,
  className = '',
}: EditableRoutinePropertyProps<T, K>) {
  const routine = useStore($routine);
  if (object && property && typeof object[property] !== 'string') {
    throw {
      error: 'T[K] must be string',
      T: object,
      K: property,
      'T[K]': typeof object[property],
    };
  }
  return (
    object &&
    property && (
      <EditableText
        onChange={(s) => {
          (object[property] as string) = s;
          $routine.set(routine);
        }}
        className={className}
      >
        {object[property] as string}
      </EditableText>
    )
  );
}
