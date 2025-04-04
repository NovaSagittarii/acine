import EditableText from './EditableText';

interface EditableRoutinePropertyProps<T, K extends keyof T> {
  object: T;
  property: K;
  callback: () => void;
  className?: string;
}

/**
 * For editing text properties of `$routine`. Shorthand for
 *
 * ```tsx
 * <EditableText
 *   onChange={(s) => {
 *     object[property] = s;
 *     callback();
 *   }}
 * >
 *   {object[property]}
 * </EditableText>
 * ```
 */
export default function EditableRoutineProperty<T, K extends keyof T>({
  object,
  property,
  callback,
  className = '',
}: EditableRoutinePropertyProps<T, K>) {
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
          callback();
        }}
        className={className}
      >
        {object[property] as string}
      </EditableText>
    )
  );
}
