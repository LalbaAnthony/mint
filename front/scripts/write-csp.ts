import { parseArgs } from 'node:util'
import { writeContentSecurityPolicy } from './content-security-policy.ts'

const usage =
  'Usage: node front/scripts/write-csp.ts --public <generated-directory> --output <nginx-snippet>'

const { values } = parseArgs({
  options: {
    public: { type: 'string' },
    output: { type: 'string' },
  },
  strict: true,
})

if (values.public === undefined || values.output === undefined) {
  throw new Error(usage)
}

const { htmlFiles, scriptHashes } = writeContentSecurityPolicy(
  values.public,
  values.output,
)
console.log(
  `write-csp: ${scriptHashes.length} inline script hash(es) from ${htmlFiles.length} HTML file(s) written to ${values.output}`,
)
