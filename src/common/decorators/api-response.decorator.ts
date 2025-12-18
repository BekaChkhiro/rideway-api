import { applyDecorators, Type } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiInternalServerErrorResponse,
  getSchemaPath,
  ApiExtraModels,
} from '@nestjs/swagger';

export const ApiSuccessResponse = <T extends Type>(
  model: T,
  isArray = false,
) => {
  return applyDecorators(
    ApiExtraModels(model),
    ApiOkResponse({
      schema: {
        properties: {
          success: { type: 'boolean', example: true },
          data: isArray
            ? { type: 'array', items: { $ref: getSchemaPath(model) } }
            : { $ref: getSchemaPath(model) },
        },
      },
    }),
  );
};

export const ApiCreatedSuccessResponse = <T extends Type>(model: T) => {
  return applyDecorators(
    ApiExtraModels(model),
    ApiCreatedResponse({
      schema: {
        properties: {
          success: { type: 'boolean', example: true },
          data: { $ref: getSchemaPath(model) },
        },
      },
    }),
  );
};

export const ApiPaginatedResponse = <T extends Type>(model: T) => {
  return applyDecorators(
    ApiExtraModels(model),
    ApiOkResponse({
      schema: {
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'array',
            items: { $ref: getSchemaPath(model) },
          },
          meta: {
            type: 'object',
            properties: {
              page: { type: 'number', example: 1 },
              limit: { type: 'number', example: 10 },
              total: { type: 'number', example: 100 },
              totalPages: { type: 'number', example: 10 },
            },
          },
        },
      },
    }),
  );
};

export const ApiErrorResponses = () => {
  return applyDecorators(
    ApiBadRequestResponse({
      schema: {
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'BAD_REQUEST' },
              message: { type: 'string', example: 'Validation failed' },
              details: {
                type: 'array',
                items: { type: 'string' },
                example: ['email must be an email'],
              },
            },
          },
        },
      },
    }),
    ApiUnauthorizedResponse({
      schema: {
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'UNAUTHORIZED' },
              message: { type: 'string', example: 'Unauthorized' },
            },
          },
        },
      },
    }),
    ApiForbiddenResponse({
      schema: {
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'FORBIDDEN' },
              message: { type: 'string', example: 'Forbidden' },
            },
          },
        },
      },
    }),
    ApiNotFoundResponse({
      schema: {
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'NOT_FOUND' },
              message: { type: 'string', example: 'Resource not found' },
            },
          },
        },
      },
    }),
    ApiInternalServerErrorResponse({
      schema: {
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'INTERNAL_ERROR' },
              message: { type: 'string', example: 'Internal server error' },
            },
          },
        },
      },
    }),
  );
};
