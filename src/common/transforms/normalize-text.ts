import { Transform } from 'class-transformer';

// Trims the value and collapses repeated whitespace into a single space.
// A string made only of spaces becomes '' so @IsNotEmpty() rejects it.
export function NormalizeText(): PropertyDecorator {
  return Transform(({ value }) =>
    typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value,
  );
}
