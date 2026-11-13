import { fileURLToPath } from 'node:url'
import { format, resolveConfig } from 'prettier'
import { buildOpenApiDocument } from '../openapi/document.js'
import { apiRoutes } from '../routes/index.js'

export const openApiDocumentPath = fileURLToPath(
  new URL('../../docs/openapi.json', import.meta.url),
)

export async function renderOpenApiDocument(): Promise<string> {
  const options = await resolveConfig(openApiDocumentPath)
  return format(JSON.stringify(buildOpenApiDocument(apiRoutes)), {
    ...options,
    parser: 'json',
  })
}
