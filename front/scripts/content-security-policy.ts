import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const scriptElementPattern = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi
const scriptOpeningPattern = /<script\b/gi
const typeAttributePattern =
  /(?:^|\s)type\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i
const srcAttributePattern = /(?:^|\s)src(?=\s*=|\s|\/|$)/i
const nginxHeaderPattern =
  /^add_header Content-Security-Policy "([^"]*)" always;$/m

const javaScriptMimeEssences = new Set([
  'application/ecmascript',
  'application/javascript',
  'application/x-ecmascript',
  'application/x-javascript',
  'text/ecmascript',
  'text/javascript',
  'text/javascript1.0',
  'text/javascript1.1',
  'text/javascript1.2',
  'text/javascript1.3',
  'text/javascript1.4',
  'text/javascript1.5',
  'text/jscript',
  'text/livescript',
  'text/x-ecmascript',
  'text/x-javascript',
])

const executableNonMimeTypes = new Set([
  'module',
  'importmap',
  'speculationrules',
])

const requiredHtmlFiles = ['index.html', '200.html']

function readTypeAttribute(attributes: string): string | undefined {
  const match = typeAttributePattern.exec(attributes)
  if (match === null) {
    return undefined
  }
  return match[1] ?? match[2] ?? match[3] ?? ''
}

export function isExecutableScriptType(type: string | undefined): boolean {
  if (type === undefined) {
    return true
  }
  const normalized = type.trim().toLowerCase()
  if (normalized === '' || executableNonMimeTypes.has(normalized)) {
    return true
  }
  const essence = normalized.split(';', 1)[0]?.trim() ?? ''
  return javaScriptMimeEssences.has(essence)
}

export function extractExecutableInlineScripts(html: string): string[] {
  const openings = html.match(scriptOpeningPattern)?.length ?? 0
  const elements = [...html.matchAll(scriptElementPattern)]
  if (elements.length !== openings) {
    throw new Error(
      `found ${openings} <script> opening tag(s) but parsed ${elements.length} complete element(s)`,
    )
  }
  return elements
    .filter(([, attributes = '']) => !srcAttributePattern.test(attributes))
    .filter(([, attributes = '']) =>
      isExecutableScriptType(readTypeAttribute(attributes)),
    )
    .map(([, , content = '']) => content)
}

export function hashScript(content: string): string {
  const normalized = content.replace(/\r\n?/g, '\n')
  const digest = createHash('sha256').update(normalized, 'utf8').digest()
  return `sha256-${digest.toString('base64')}`
}

export function buildContentSecurityPolicy(
  scriptHashes: readonly string[],
): string {
  const scriptSources = [
    "'self'",
    ...[...new Set(scriptHashes)].sort().map((hash) => `'${hash}'`),
  ]
  return [
    "default-src 'self'",
    `script-src ${scriptSources.join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "manifest-src 'self'",
    "worker-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ')
}

export function readScriptSourceHashes(policy: string): string[] {
  const scriptDirective = policy
    .split(';')
    .map((directive) => directive.trim().split(/\s+/))
    .find(([name]) => name === 'script-src')
  if (scriptDirective === undefined) {
    return []
  }
  return scriptDirective
    .slice(1)
    .filter((source) => /^'sha256-[A-Za-z0-9+/]+={0,2}'$/.test(source))
    .map((source) => source.slice(1, -1))
}

export function findUncoveredScripts(html: string, policy: string): string[] {
  const allowedHashes = new Set(readScriptSourceHashes(policy))
  return extractExecutableInlineScripts(html)
    .map(hashScript)
    .filter((hash) => !allowedHashes.has(hash))
}

export function renderNginxHeader(policy: string): string {
  return `add_header Content-Security-Policy "${policy}" always;\n`
}

export function readPolicyFromNginxHeader(content: string): string {
  const match = nginxHeaderPattern.exec(content)
  if (match?.[1] === undefined) {
    throw new Error('no Content-Security-Policy add_header directive found')
  }
  return match[1]
}

export function listHtmlFiles(publicDirectory: string): string[] {
  return readdirSync(publicDirectory, { recursive: true, encoding: 'utf8' })
    .filter((path) => path.endsWith('.html'))
    .sort()
}

function readHtml(publicDirectory: string, path: string): string {
  return readFileSync(join(publicDirectory, path), 'utf8')
}

function collectScriptHashes(publicDirectory: string, htmlFiles: string[]) {
  return htmlFiles.flatMap((path) => {
    try {
      return extractExecutableInlineScripts(
        readHtml(publicDirectory, path),
      ).map(hashScript)
    } catch (error) {
      throw new Error(`${path}: cannot extract inline scripts`, {
        cause: error,
      })
    }
  })
}

export function writeContentSecurityPolicy(
  publicDirectory: string,
  outputFile: string,
) {
  const missingFiles = requiredHtmlFiles.filter(
    (path) => !existsSync(join(publicDirectory, path)),
  )
  if (missingFiles.length > 0) {
    throw new Error(
      `missing ${missingFiles.join(', ')} in ${publicDirectory}, run nuxt generate first`,
    )
  }

  const htmlFiles = listHtmlFiles(publicDirectory)
  const policy = buildContentSecurityPolicy(
    collectScriptHashes(publicDirectory, htmlFiles),
  )
  writeFileSync(outputFile, renderNginxHeader(policy))

  const writtenPolicy = readPolicyFromNginxHeader(
    readFileSync(outputFile, 'utf8'),
  )
  const uncovered = htmlFiles.flatMap((path) =>
    findUncoveredScripts(readHtml(publicDirectory, path), writtenPolicy).map(
      (hash) => `${path}: inline script ${hash} is not allowed by script-src`,
    ),
  )
  if (uncovered.length > 0) {
    throw new Error(uncovered.join('\n'))
  }

  return {
    htmlFiles,
    scriptHashes: readScriptSourceHashes(writtenPolicy),
  }
}
