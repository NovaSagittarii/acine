import Annotation from './Annotation';
import EditableText from './EditableText';

interface EditableRoutinePropertyProps<T, K extends keyof T> {
  object: T;
  property: K & string;
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
    // eslint-disable-next-line @typescript-eslint/only-throw-error
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
      <Annotation label={property}>
        <EditableText
          onChange={(s) => {
            (object[property] as string) = s;
            callback();
          }}
          className={className}
        >
          {object[property] ? (
            (object[property] as string)
          ) : (
            <div className='opacity-50'>{'<unset>'}</div>
          )}
        </EditableText>
      </Annotation>
    )
  );
}
