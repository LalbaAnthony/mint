import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { apiRoutes } from '../routes/index.js'
import {
  openApiDocumentPath,
  renderOpenApiDocument,
} from '../scripts/openapi.js'
import { buildOpenApiDocument } from './document.js'

describe('OpenAPI document (NF-QUA-06)', () => {
  it('documents every route with its method', () => {
    const document = buildOpenApiDocument(apiRoutes)

    const operations = Object.entries(document.paths ?? {}).flatMap(
      ([path, item]) => Object.keys(item).map((method) => `${method} ${path}`),
    )

    expect(operations.sort()).toEqual(
      apiRoutes
        .map(
          (route) =>
            `${route.method} /api/v1${route.path.replace(/:([A-Za-z]+)/g, '{$1}')}`,
        )
        .sort(),
    )
  })

  it('is up to date in docs/openapi.json (run npm run openapi -w @mint/api)', async () => {
    expect(await readFile(openApiDocumentPath, 'utf8')).toBe(
      await renderOpenApiDocument(),
    )
  })
})
