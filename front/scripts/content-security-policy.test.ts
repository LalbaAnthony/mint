import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  buildContentSecurityPolicy,
  extractExecutableInlineScripts,
  findUncoveredScripts,
  hashScript,
  isExecutableScriptType,
  listHtmlFiles,
  readPolicyFromNginxHeader,
  readScriptSourceHashes,
  renderNginxHeader,
  writeContentSecurityPolicy,
} from './content-security-policy.ts'

const helloWorldScript = "alert('Hello, world.');"
const helloWorldHash = 'sha256-qznLcsROx4GACP2dm0UCKCzCG+HiZ1guq6ZZDob/Tng='

function page(body: string): string {
  return `<!DOCTYPE html><html><head><script type="module" src="/_nuxt/entry.js" crossorigin></script></head><body>${body}</body></html>`
}

const nuxtConfigScript =
  'window.__NUXT__={};window.__NUXT__.config={app:{buildId:"build"}}'

const nuxtShell = page(
  `<div id="__nuxt"></div><script>${nuxtConfigScript}</script><script type="application/json" data-nuxt-data="nuxt-app" id="__NUXT_DATA__">[{"prerenderedAt":1}]</script>`,
)

let sandbox = ''

function writeSandboxFile(path: string, content: string): void {
  const absolutePath = join(sandbox, path)
  mkdirSync(dirname(absolutePath), { recursive: true })
  writeFileSync(absolutePath, content)
}

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'mint-csp-'))
})

afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true })
})

describe('isExecutableScriptType', () => {
  it.each([
    undefined,
    '',
    '  ',
    'module',
    'MODULE',
    'importmap',
    'speculationrules',
    'text/javascript',
    'Text/JavaScript',
    'application/javascript',
    'text/javascript; charset=utf-8',
  ])('treats %j as executable', (type) => {
    expect(isExecutableScriptType(type)).toBe(true)
  })

  it.each(['application/json', 'application/ld+json', 'text/template'])(
    'treats %j as a data block',
    (type) => {
      expect(isExecutableScriptType(type)).toBe(false)
    },
  )
})

describe('extractExecutableInlineScripts', () => {
  it('keeps inline executable scripts and skips external and data scripts', () => {
    expect(extractExecutableInlineScripts(nuxtShell)).toEqual([
      nuxtConfigScript,
    ])
  })

  it('keeps module, import map and unquoted type scripts', () => {
    const html = page(
      '<script type="module">a()</script><script type=importmap>{}</script><script type=text/javascript>b()</script>',
    )

    expect(extractExecutableInlineScripts(html)).toEqual(['a()', '{}', 'b()'])
  })

  it('does not mistake a data-src attribute for src', () => {
    expect(
      extractExecutableInlineScripts(page('<script data-src="x">c()</script>')),
    ).toEqual(['c()'])
  })

  it('fails on a script element it cannot parse', () => {
    expect(() =>
      extractExecutableInlineScripts(page('<script>unterminated()')),
    ).toThrow(
      'found 2 <script> opening tag(s) but parsed 1 complete element(s)',
    )
  })
})

describe('hashScript', () => {
  it('produces the CSP sha256 source of the script text', () => {
    expect(hashScript(helloWorldScript)).toBe(helloWorldHash)
  })

  it('normalizes line endings like the HTML parser', () => {
    expect(hashScript('a()\r\nb()\rc()')).toBe(hashScript('a()\nb()\nc()'))
  })
})

describe('buildContentSecurityPolicy', () => {
  it('allows only self and the given hashes for scripts', () => {
    expect(buildContentSecurityPolicy([helloWorldHash, helloWorldHash])).toBe(
      [
        "default-src 'self'",
        `script-src 'self' '${helloWorldHash}'`,
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
      ].join('; '),
    )
  })

  it('never allows unsafe-inline scripts', () => {
    const scriptDirective = buildContentSecurityPolicy([])
      .split('; ')
      .find((directive) => directive.startsWith('script-src'))

    expect(scriptDirective).toBe("script-src 'self'")
  })
})

describe('readScriptSourceHashes', () => {
  it('reads the hashes of script-src only', () => {
    const policy = `default-src 'self'; script-src 'self' '${helloWorldHash}'; style-src 'sha256-c3R5bGU='`

    expect(readScriptSourceHashes(policy)).toEqual([helloWorldHash])
  })

  it('returns nothing without a script-src directive', () => {
    expect(readScriptSourceHashes("default-src 'self'")).toEqual([])
  })
})

describe('findUncoveredScripts', () => {
  it('reports an inline script whose hash is missing from the policy (CA-12)', () => {
    const html = page(`<script>${helloWorldScript}</script>`)

    expect(findUncoveredScripts(html, buildContentSecurityPolicy([]))).toEqual([
      helloWorldHash,
    ])
  })

  it('reports nothing when every inline script is covered', () => {
    const html = page(`<script>${helloWorldScript}</script>`)
    const policy = buildContentSecurityPolicy([helloWorldHash])

    expect(findUncoveredScripts(html, policy)).toEqual([])
  })
})

describe('nginx header', () => {
  it('round-trips the policy through the add_header directive', () => {
    const policy = buildContentSecurityPolicy([helloWorldHash])

    expect(readPolicyFromNginxHeader(renderNginxHeader(policy))).toBe(policy)
  })

  it('fails when the directive is missing', () => {
    expect(() => readPolicyFromNginxHeader('add_header X-Other "1";')).toThrow(
      'no Content-Security-Policy add_header directive found',
    )
  })
})

describe('listHtmlFiles', () => {
  it('lists HTML files recursively', () => {
    writeSandboxFile('index.html', nuxtShell)
    writeSandboxFile('accounts/index.html', nuxtShell)
    writeSandboxFile('_nuxt/entry.js', 'export {}')

    expect(listHtmlFiles(sandbox)).toEqual([
      join('accounts', 'index.html'),
      'index.html',
    ])
  })
})

describe('writeContentSecurityPolicy', () => {
  const outputFile = () => join(sandbox, 'content-security-policy.conf')
  const publicDirectory = () => join(sandbox, 'public')

  it('writes one hash per distinct inline script across all HTML files', () => {
    writeSandboxFile('public/index.html', nuxtShell)
    writeSandboxFile('public/200.html', nuxtShell)
    writeSandboxFile(
      'public/accounts/index.html',
      page(`<script>${helloWorldScript}</script>`),
    )

    const result = writeContentSecurityPolicy(publicDirectory(), outputFile())

    const expectedHashes = [hashScript(nuxtConfigScript), helloWorldHash].sort()
    expect(result.htmlFiles).toHaveLength(3)
    expect(result.scriptHashes).toEqual(expectedHashes)
    expect(readFileSync(outputFile(), 'utf8')).toBe(
      renderNginxHeader(buildContentSecurityPolicy(expectedHashes)),
    )
  })

  it('fails when 200.html is missing', () => {
    writeSandboxFile('public/index.html', nuxtShell)

    expect(() =>
      writeContentSecurityPolicy(publicDirectory(), outputFile()),
    ).toThrow(/missing 200\.html/)
  })

  it('fails and names the file when a script cannot be parsed', () => {
    writeSandboxFile('public/index.html', nuxtShell)
    writeSandboxFile('public/200.html', page('<script>broken()'))

    expect(() =>
      writeContentSecurityPolicy(publicDirectory(), outputFile()),
    ).toThrow('200.html: cannot extract inline scripts')
  })
})
