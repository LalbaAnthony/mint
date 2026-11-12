import { readFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import {
  extractCommitMessage,
  findForbiddenCharacters,
  findForbiddenContent,
  formatFinding,
  isBinary,
} from './forbidden-content.ts'
import { listTrackedFiles, readCommitMessages } from './git.ts'

const usage =
  'Usage: node scripts/scan.ts --all | --message <file> | --commits <revision-range>'

const { values } = parseArgs({
  options: {
    all: { type: 'boolean' },
    message: { type: 'string' },
    commits: { type: 'string' },
  },
  strict: true,
})

function isMissingFileError(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT'
}

function readWorkingTreeFile(path: string): Buffer | undefined {
  try {
    return readFileSync(path)
  } catch (error) {
    if (isMissingFileError(error)) {
      return undefined
    }
    throw error
  }
}

function scanTrackedFiles(): string[] {
  const reports: string[] = []
  for (const path of listTrackedFiles()) {
    const content = readWorkingTreeFile(path)
    if (content === undefined || isBinary(content)) {
      continue
    }
    for (const finding of findForbiddenContent(
      path,
      content.toString('utf8'),
    )) {
      reports.push(formatFinding(path, finding))
    }
  }
  return reports
}

function scanMessageFile(messageFile: string): string[] {
  const message = extractCommitMessage(readFileSync(messageFile, 'utf8'))
  return findForbiddenCharacters(message).map((finding) =>
    formatFinding('commit message', finding),
  )
}

function scanCommits(revisionRange: string): string[] {
  return readCommitMessages(revisionRange).flatMap(({ commit, message }) =>
    findForbiddenCharacters(message).map((finding) =>
      formatFinding(`commit ${commit}`, finding),
    ),
  )
}

function selectReports(): string[] {
  if (values.all === true) {
    return scanTrackedFiles()
  }
  if (values.message !== undefined) {
    return scanMessageFile(values.message)
  }
  if (values.commits !== undefined) {
    return scanCommits(values.commits)
  }
  throw new Error(usage)
}

const reports = selectReports()
for (const report of reports) {
  console.error(report)
}
if (reports.length > 0) {
  console.error(`scan: ${reports.length} forbidden occurrence(s) found`)
  process.exitCode = 1
}
