import { ValidateIf } from 'class-validator';

// Like @IsOptional(), but only an absent value is skipped.
// An explicit null still runs the other validators, so it is rejected with 400.
export function IsOptionalNotNull(): PropertyDecorator {
  return ValidateIf((_object, value) => value !== undefined);
}
