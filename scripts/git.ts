import { execFileSync } from 'node:child_process'

const maxOutputBytes = 512 * 1024 * 1024

function runGit(args: string[]): Buffer {
  return execFileSync('git', args, { maxBuffer: maxOutputBytes })
}

function splitNulSeparated(output: Buffer): string[] {
  return output
    .toString('utf8')
    .split('\0')
    .filter((entry) => entry !== '')
}

export function listTrackedFiles(): string[] {
  return splitNulSeparated(runGit(['ls-files', '-z']))
}

export function listStagedFiles(): string[] {
  return splitNulSeparated(
    runGit(['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z']),
  )
}

export function readStagedFile(path: string): Buffer {
  return runGit(['cat-file', 'blob', `:${path}`])
}

export function readCommitMessages(revisionRange: string) {
  const output = runGit([
    'log',
    '--format=%H%n%B%x00',
    revisionRange,
    '--',
  ]).toString('utf8')
  return output
    .split('\0')
    .map((entry) => entry.replace(/^\n/, ''))
    .filter((entry) => entry.trim() !== '')
    .map((entry) => {
      const firstNewline = entry.indexOf('\n')
      return {
        commit: entry.slice(0, firstNewline),
        message: entry.slice(firstNewline + 1),
      }
    })
}
