import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

// At least 3 of the 4 character classes: lowercase, uppercase, digit, symbol.
const PASSWORD_CHARACTER_CLASSES = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/];
const MIN_CHARACTER_CLASSES = 3;

export function IsStrongPassword(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isStrongPassword',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          if (typeof value !== 'string') return false;
          const classesPresent = PASSWORD_CHARACTER_CLASSES.filter((pattern) =>
            pattern.test(value),
          ).length;
          return classesPresent >= MIN_CHARACTER_CLASSES;
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must contain at least ${MIN_CHARACTER_CLASSES} of: lowercase letter, uppercase letter, digit, symbol`;
        },
      },
    });
  };
}
