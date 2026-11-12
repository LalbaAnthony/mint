import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const writeCspScript = join(
  dirname(fileURLToPath(import.meta.url)),
  'write-csp.ts',
)

const shell =
  '<!DOCTYPE html><html><body><script>window.__NUXT__={}</script></body></html>'

let sandbox = ''

function runWriteCsp(...args: string[]) {
  const result = spawnSync(process.execPath, [writeCspScript, ...args], {
    cwd: sandbox,
    encoding: 'utf8',
  })
  return { status: result.status, stdout: result.stdout, stderr: result.stderr }
}

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'mint-write-csp-'))
})

afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true })
})

describe('write-csp', () => {
  it('writes the nginx snippet and reports the hash count', () => {
    writeFileSync(join(sandbox, 'index.html'), shell)
    writeFileSync(join(sandbox, '200.html'), shell)

    const result = runWriteCsp('--public', '.', '--output', 'csp.conf')

    expect(result.status).toBe(0)
    expect(result.stdout).toContain(
      'write-csp: 1 inline script hash(es) from 2 HTML file(s) written to csp.conf',
    )
    expect(readFileSync(join(sandbox, 'csp.conf'), 'utf8')).toMatch(
      /^add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'sha256-[^']+';/,
    )
  })

  it('fails without its arguments', () => {
    const result = runWriteCsp('--public', '.')

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('Usage: node front/scripts/write-csp.ts')
  })

  it('fails when the generated HTML is missing', () => {
    const result = runWriteCsp('--public', '.', '--output', 'csp.conf')

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('missing index.html, 200.html')
  })
})
