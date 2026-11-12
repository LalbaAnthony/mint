import { resolve } from 'node:path'
import { ESLint } from 'eslint'
import * as prettier from 'prettier'
import {
  findForbiddenContent,
  formatFinding,
  isBinary,
} from './forbidden-content.ts'
import { listStagedFiles, readStagedFile } from './git.ts'

const prettierIgnoreFiles = ['.gitignore', '.prettierignore']

const stagedTextFiles = listStagedFiles()
  .map((path) => ({ path, content: readStagedFile(path) }))
  .filter(({ content }) => !isBinary(content))
  .map(({ path, content }) => ({
    path,
    absolutePath: resolve(path),
    text: content.toString('utf8'),
  }))

function scanForbiddenContent(): number {
  let findingCount = 0
  for (const file of stagedTextFiles) {
    for (const finding of findForbiddenContent(file.path, file.text)) {
      console.error(formatFinding(file.path, finding))
      findingCount += 1
    }
  }
  return findingCount
}

async function lintStagedFiles(): Promise<number> {
  const eslint = new ESLint()
  const results: ESLint.LintResult[] = []
  for (const file of stagedTextFiles) {
    if (await eslint.isPathIgnored(file.absolutePath)) {
      continue
    }
    results.push(
      ...(await eslint.lintText(file.text, {
        filePath: file.absolutePath,
        warnIgnored: false,
      })),
    )
  }
  const formatter = await eslint.loadFormatter('stylish')
  const output = await formatter.format(results)
  if (output !== '') {
    console.error(output)
  }
  return results.reduce(
    (problemCount, result) =>
      problemCount + result.errorCount + result.warningCount,
    0,
  )
}

async function checkStagedFormatting(): Promise<number> {
  let unformattedCount = 0
  for (const file of stagedTextFiles) {
    const fileInfo = await prettier.getFileInfo(file.absolutePath, {
      ignorePath: prettierIgnoreFiles,
    })
    if (fileInfo.ignored || fileInfo.inferredParser === null) {
      continue
    }
    const options = await prettier.resolveConfig(file.absolutePath, {
      editorconfig: true,
    })
    const isFormatted = await prettier.check(file.text, {
      ...options,
      filepath: file.absolutePath,
    })
    if (!isFormatted) {
      console.error(`prettier: ${file.path} is not formatted`)
      unformattedCount += 1
    }
  }
  return unformattedCount
}

const failureCount =
  scanForbiddenContent() +
  (await lintStagedFiles()) +
  (await checkStagedFormatting())

if (failureCount > 0) {
  console.error(
    `pre-commit: ${failureCount} problem(s) in staged files, commit rejected`,
  )
  process.exitCode = 1
}
