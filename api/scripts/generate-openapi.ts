import { writeFile } from 'node:fs/promises'
import { openApiDocumentPath, renderOpenApiDocument } from './openapi.js'

await writeFile(openApiDocumentPath, await renderOpenApiDocument())
process.stdout.write(`OpenAPI document written to ${openApiDocumentPath}\n`)
