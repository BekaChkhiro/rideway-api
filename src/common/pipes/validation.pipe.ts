import {
  ValidationPipe as NestValidationPipe,
  ValidationPipeOptions,
  BadRequestException,
  ValidationError,
} from '@nestjs/common';

export class ValidationPipe extends NestValidationPipe {
  constructor(options?: ValidationPipeOptions) {
    super({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      exceptionFactory: (errors: ValidationError[]) => {
        const messages = this.formatErrors(errors);
        return new BadRequestException({
          message: messages[0] || 'Validation failed',
          errors: messages,
        });
      },
      ...options,
    });
  }

  private formatErrors(errors: ValidationError[], parentPath = ''): string[] {
    const messages: string[] = [];

    for (const error of errors) {
      const propertyPath = parentPath
        ? `${parentPath}.${error.property}`
        : error.property;

      if (error.constraints) {
        const constraintMessages = Object.values(error.constraints);
        messages.push(...constraintMessages);
      }

      if (error.children && error.children.length > 0) {
        messages.push(...this.formatErrors(error.children, propertyPath));
      }
    }

    return messages;
  }
}
