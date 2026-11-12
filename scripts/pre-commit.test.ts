import { spawnSync } from 'node:child_process'
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const preCommitScript = join(projectRoot, 'scripts', 'pre-commit.ts')
const emDash = '\u{2014}'

let sandbox = ''
let repository = ''

function isolatedGitEnvironment() {
  return {
    ...process.env,
    GIT_CONFIG_GLOBAL: join(sandbox, 'gitconfig'),
    GIT_CONFIG_NOSYSTEM: '1',
  }
}

function git(...args: string[]): void {
  const result = spawnSync('git', args, {
    cwd: repository,
    env: isolatedGitEnvironment(),
    encoding: 'utf8',
  })
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`)
  }
}

function writeRepositoryFile(path: string, content: string): void {
  const absolutePath = join(repository, path)
  mkdirSync(dirname(absolutePath), { recursive: true })
  writeFileSync(absolutePath, content)
}

function stage(path: string, content: string): void {
  writeRepositoryFile(path, content)
  git('add', path)
}

function runPreCommit() {
  const result = spawnSync(process.execPath, [preCommitScript], {
    cwd: repository,
    env: isolatedGitEnvironment(),
    encoding: 'utf8',
  })
  return { status: result.status, stderr: result.stderr }
}

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'mint-pre-commit-'))
  repository = join(sandbox, 'repository')
  mkdirSync(repository)
  writeFileSync(join(sandbox, 'gitconfig'), '')
  for (const configFile of ['eslint.config.ts', '.prettierrc.json']) {
    copyFileSync(join(projectRoot, configFile), join(repository, configFile))
  }
  writeRepositoryFile('package.json', '{ "type": "module" }\n')
  writeRepositoryFile('.gitignore', 'node_modules/\n')
  symlinkSync(
    join(projectRoot, 'node_modules'),
    join(repository, 'node_modules'),
    'junction',
  )
  git('init', '--quiet')
})

afterEach(() => {
  unlinkSync(join(repository, 'node_modules'))
  rmSync(sandbox, { recursive: true, force: true })
})

describe('pre-commit', () => {
  it('accepts clean staged files', () => {
    stage('api/index.ts', "export const name = 'mint'\n")
    stage('docs/notes.md', '# Notes\n')

    expect(runPreCommit().status).toBe(0)
  })

  it('rejects a staged ESLint violation', () => {
    stage('api/index.ts', 'export const value: any = 1\n')

    const result = runPreCommit()

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('@typescript-eslint/no-explicit-any')
  })

  it('rejects a staged file that Prettier would reformat', () => {
    stage('api/index.ts', 'export const name = "mint";\n')

    const result = runPreCommit()

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('prettier: api/index.ts is not formatted')
  })

  it('rejects a forbidden character in a staged file', () => {
    stage('docs/notes.md', `# Notes ${emDash} draft\n`)

    const result = runPreCommit()

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('docs/notes.md:1:9 forbidden character')
  })

  it('rejects text-blue-600 in a staged Vue file under front/app (CA-10)', () => {
    stage(
      'front/app/app.vue',
      '<template>\n  <p class="text-blue-600">Mint</p>\n</template>\n',
    )

    const result = runPreCommit()

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('raw palette class text-blue-600')
  })

  it('checks the staged content, not the working tree', () => {
    stage('api/index.ts', 'export const value: any = 1\n')
    writeRepositoryFile('api/index.ts', "export const name = 'mint'\n")

    expect(runPreCommit().status).toBe(1)
  })

  it('ignores unstaged changes and untracked files', () => {
    stage('api/index.ts', "export const name = 'mint'\n")
    writeRepositoryFile('api/index.ts', 'export const value: any = 1\n')
    writeRepositoryFile('docs/untracked.md', `${emDash}\n`)

    expect(runPreCommit().status).toBe(0)
  })
})
