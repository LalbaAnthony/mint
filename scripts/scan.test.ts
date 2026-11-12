import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const scanScript = join(dirname(fileURLToPath(import.meta.url)), 'scan.ts')
const emDash = '\u{2014}'

let sandbox = ''
let repository = ''

function isolatedGitEnvironment() {
  return {
    ...process.env,
    GIT_CONFIG_GLOBAL: join(sandbox, 'gitconfig'),
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_AUTHOR_NAME: 'Scan Test',
    GIT_AUTHOR_EMAIL: 'scan-test@example.invalid',
    GIT_COMMITTER_NAME: 'Scan Test',
    GIT_COMMITTER_EMAIL: 'scan-test@example.invalid',
  }
}

function git(...args: string[]): string {
  const result = spawnSync('git', args, {
    cwd: repository,
    env: isolatedGitEnvironment(),
    encoding: 'utf8',
  })
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`)
  }
  return result.stdout.trim()
}

function writeRepositoryFile(path: string, content: string): void {
  const absolutePath = join(repository, path)
  mkdirSync(dirname(absolutePath), { recursive: true })
  writeFileSync(absolutePath, content)
}

function commitAll(message: string): string {
  git('add', '--all')
  const tree = git('write-tree')
  const parent = spawnSync('git', ['rev-parse', '--verify', 'HEAD'], {
    cwd: repository,
    env: isolatedGitEnvironment(),
    encoding: 'utf8',
  })
  const parentArgs = parent.status === 0 ? ['-p', parent.stdout.trim()] : []
  const commit = git('commit-tree', tree, ...parentArgs, '-m', message)
  git('update-ref', 'HEAD', commit)
  return commit
}

function runScan(...args: string[]) {
  const result = spawnSync(process.execPath, [scanScript, ...args], {
    cwd: repository,
    env: isolatedGitEnvironment(),
    encoding: 'utf8',
  })
  return { status: result.status, stderr: result.stderr }
}

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'mint-scan-'))
  repository = join(sandbox, 'repository')
  mkdirSync(repository)
  writeFileSync(join(sandbox, 'gitconfig'), '')
  git('init', '--quiet')
})

afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true })
})

describe('scan --all', () => {
  it('passes on clean tracked files', () => {
    writeRepositoryFile('docs/clean.md', 'Texte \u{AB} propre \u{BB}.\n')
    git('add', '--all')

    const result = runScan('--all')

    expect(result.status).toBe(0)
    expect(result.stderr).not.toContain('forbidden')
  })

  it('fails on an em dash in a tracked file', () => {
    writeRepositoryFile('docs/dirty.md', `ligne\navec ${emDash}\n`)
    git('add', '--all')

    const result = runScan('--all')

    expect(result.status).toBe(1)
    expect(result.stderr).toContain(
      'docs/dirty.md:2:6 forbidden character U+2014',
    )
  })

  it('fails on text-blue-600 in a Vue file under front/app (CA-10)', () => {
    writeRepositoryFile(
      'front/app/app.vue',
      '<template><p class="text-blue-600">x</p></template>\n',
    )
    git('add', '--all')

    const result = runScan('--all')

    expect(result.status).toBe(1)
    expect(result.stderr).toContain(
      'front/app/app.vue:1:21 raw palette class text-blue-600 (CHG-104)',
    )
  })

  it('ignores untracked files and binary files', () => {
    writeRepositoryFile('untracked.md', emDash)
    writeRepositoryFile('tracked.bin', `\0${emDash}`)
    git('add', 'tracked.bin')

    expect(runScan('--all').status).toBe(0)
  })

  it('skips tracked files deleted from the working tree', () => {
    writeRepositoryFile('gone.md', 'x\n')
    git('add', '--all')
    rmSync(join(repository, 'gone.md'))

    expect(runScan('--all').status).toBe(0)
  })
})

describe('scan --message', () => {
  it('fails on an em dash in the commit message', () => {
    writeRepositoryFile('COMMIT_EDITMSG', `feat: add ${emDash} accounts\n`)

    const result = runScan('--message', 'COMMIT_EDITMSG')

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('commit message:1:11')
  })

  it('ignores comment lines of the commit message', () => {
    writeRepositoryFile(
      'COMMIT_EDITMSG',
      `feat: add accounts\n# changes on ${emDash}\n`,
    )

    expect(runScan('--message', 'COMMIT_EDITMSG').status).toBe(0)
  })
})

describe('scan --commits', () => {
  it('fails on a forbidden character in a commit of the range', () => {
    writeRepositoryFile('a.md', 'a\n')
    const base = commitAll('chore: init')
    writeRepositoryFile('b.md', 'b\n')
    const dirty = commitAll(`feat: add b ${emDash}`)
    writeRepositoryFile('c.md', 'c\n')
    commitAll('feat: add c')

    const result = runScan('--commits', `${base}..HEAD`)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain(`commit ${dirty}:1:13`)
  })

  it('passes when every commit of the range is clean', () => {
    writeRepositoryFile('a.md', 'a\n')
    const base = commitAll('chore: init')
    writeRepositoryFile('b.md', 'b\n')
    commitAll('feat: add b')

    expect(runScan('--commits', `${base}..HEAD`).status).toBe(0)
  })
})

describe('scan without mode', () => {
  it('fails with the usage', () => {
    const result = runScan()

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('Usage: node scripts/scan.ts')
  })
})
