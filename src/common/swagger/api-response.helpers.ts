import { applyDecorators, Type } from '@nestjs/common'
import { ApiExtraModels, ApiResponse, getSchemaPath } from '@nestjs/swagger'

// Every response is wrapped by DataResponseInterceptor as { apiVersion, data }.
// These helpers document that envelope so the generated OpenAPI types expose the
// real response shape instead of `content?: never`. Used instead of decorating
// each controller with a raw schema by hand.

// Shared schema for the meta/links blocks of a paginated response, mirroring
// the Paginated interface (src/common/pagination/interfaces/paginated.interface.ts).
const paginationMetaSchema = {
  type: 'object',
  properties: {
    itemsPerPage: { type: 'number' },
    totalItems: { type: 'number' },
    currentPage: { type: 'number' },
    totalPages: { type: 'number' },
    hasNextPage: { type: 'boolean' },
    hasPrevPage: { type: 'boolean' },
  },
} as const

const paginationLinksSchema = {
  type: 'object',
  properties: {
    first: { type: 'string' },
    last: { type: 'string' },
    current: { type: 'string' },
    next: { type: 'string' },
    prev: { type: 'string' },
  },
} as const

interface DataResponseOptions {
  status?: number
  description?: string
}

/**
 * Documents a single-object response: { apiVersion, data: model }.
 * Pass status 201 for create/upload endpoints.
 */
export function ApiDataResponse<TModel extends Type<unknown>>(
  model: TModel,
  options: DataResponseOptions = {},
) {
  const { status = 200, description } = options
  return applyDecorators(
    ApiExtraModels(model),
    ApiResponse({
      status,
      description,
      schema: {
        type: 'object',
        properties: {
          apiVersion: { type: 'string' },
          data: { $ref: getSchemaPath(model) },
        },
      },
    }),
  )
}

/**
 * Documents a bare-array response: { apiVersion, data: model[] }.
 * Used by endpoints that return a list without pagination.
 */
export function ApiArrayDataResponse<TModel extends Type<unknown>>(
  model: TModel,
  options: DataResponseOptions = {},
) {
  const { status = 200, description } = options
  return applyDecorators(
    ApiExtraModels(model),
    ApiResponse({
      status,
      description,
      schema: {
        type: 'object',
        properties: {
          apiVersion: { type: 'string' },
          data: {
            type: 'array',
            items: { $ref: getSchemaPath(model) },
          },
        },
      },
    }),
  )
}

/**
 * Documents a paginated response:
 * { apiVersion, data: { data: model[], meta, links } }.
 */
export function ApiPaginatedResponse<TModel extends Type<unknown>>(
  model: TModel,
  options: DataResponseOptions = {},
) {
  const { status = 200, description } = options
  return applyDecorators(
    ApiExtraModels(model),
    ApiResponse({
      status,
      description,
      schema: {
        type: 'object',
        properties: {
          apiVersion: { type: 'string' },
          data: {
            type: 'object',
            properties: {
              data: {
                type: 'array',
                items: { $ref: getSchemaPath(model) },
              },
              meta: paginationMetaSchema,
              links: paginationLinksSchema,
            },
          },
        },
      },
    }),
  )
}
