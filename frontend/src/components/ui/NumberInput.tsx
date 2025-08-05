import EditableText from './EditableText';

interface NumberInputProps<T, K extends keyof T> {
  className?: string;
  label?: string;
  object: T;
  property: K;
  callback: () => void;
  format?: (x: number) => string;
}

/**
 * For editing numeric properties. Automatically rejects strings
 * that cannot be coerced into numbers by checking `isNaN(+s)`
 */
export default function NumberInput<T, K extends keyof T>({
  object,
  property,
  callback,
  format = (x) => x.toString(),
  className = '',
  label = property as string,
}: NumberInputProps<T, K>) {
  if (object && property && typeof object[property] !== 'number') {
    throw {
      error: 'T[K] must be number',
      T: object,
      K: property,
      'T[K]': typeof object[property],
    };
  }
  return (
    object &&
    property &&
    (label ? (
      <div className='flex flex-row'>
        <EditableText
          className={'min-w-4 w-fit ' + className}
          onChange={(s) => {
            const x = +s;
            if (!isNaN(x)) {
              (object[property] as number) = x;
            }
            callback();
          }}
        >
          {format(object[property] as number)}
        </EditableText>
        <span className='opacity-50'>: {label}</span>
      </div>
    ) : (
      <EditableText
        className={className}
        onChange={(s) => {
          const x = +s;
          if (!isNaN(x)) {
            (object[property] as number) = x;
          }
          callback();
        }}
      >
        {format(object[property] as number)}
      </EditableText>
    ))
  );
}
