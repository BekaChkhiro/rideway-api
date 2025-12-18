import { BadRequestException } from '@nestjs/common';
import { IsEmail, IsString, MinLength, IsNotEmpty } from 'class-validator';
import { ValidationPipe } from '../validation.pipe';

class TestDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}

describe('ValidationPipe', () => {
  let pipe: ValidationPipe;

  beforeEach(() => {
    pipe = new ValidationPipe();
  });

  it('should pass validation with valid data', async () => {
    const validData = {
      email: 'test@example.com',
      password: 'password123',
    };

    const result = (await pipe.transform(validData, {
      type: 'body',
      metatype: TestDto,
    })) as TestDto;

    expect(result.email).toBe('test@example.com');
    expect(result.password).toBe('password123');
  });

  it('should throw BadRequestException for invalid email', async () => {
    const invalidData = {
      email: 'invalid-email',
      password: 'password123',
    };

    await expect(
      pipe.transform(invalidData, {
        type: 'body',
        metatype: TestDto,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should throw BadRequestException for short password', async () => {
    const invalidData = {
      email: 'test@example.com',
      password: 'short',
    };

    await expect(
      pipe.transform(invalidData, {
        type: 'body',
        metatype: TestDto,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should throw BadRequestException with formatted error messages', async () => {
    const invalidData = {
      email: 'invalid-email',
      password: 'short',
    };

    try {
      await pipe.transform(invalidData, {
        type: 'body',
        metatype: TestDto,
      });
      fail('Expected BadRequestException to be thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      const response = (error as BadRequestException).getResponse() as {
        message: string;
        errors: string[];
      };
      expect(response.errors).toBeDefined();
      expect(response.errors.length).toBeGreaterThan(0);
    }
  });

  it('should reject non-whitelisted properties with forbidNonWhitelisted', async () => {
    const dataWithExtra = {
      email: 'test@example.com',
      password: 'password123',
      extraField: 'should be rejected',
    };

    await expect(
      pipe.transform(dataWithExtra, {
        type: 'body',
        metatype: TestDto,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should throw BadRequestException for empty required fields', async () => {
    const invalidData = {
      email: '',
      password: 'password123',
    };

    await expect(
      pipe.transform(invalidData, {
        type: 'body',
        metatype: TestDto,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should handle missing fields', async () => {
    const invalidData = {
      email: 'test@example.com',
    };

    await expect(
      pipe.transform(invalidData, {
        type: 'body',
        metatype: TestDto,
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
