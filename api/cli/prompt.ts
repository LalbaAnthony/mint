import type { HiddenInput, PromptOutput } from '../types/cli.js'

const enterKeys = new Set(['\r', '\n', '\u0004'])
const backspaceKeys = new Set(['\u007f', '\b'])
const interruptKey = '\u0003'

export function promptHidden(
  input: HiddenInput,
  output: PromptOutput,
  question: string,
): Promise<string> {
  if (input.isTTY !== true) {
    return Promise.reject(
      new Error('An interactive terminal (TTY) is required to type a password'),
    )
  }
  return new Promise((resolve, reject) => {
    let characters: string[] = []

    function finish(error?: Error): void {
      input.removeListener('data', onData)
      input.setRawMode(false)
      input.pause()
      output.write('\n')
      if (error === undefined) {
        resolve(characters.join(''))
      } else {
        reject(error)
      }
    }

    function onData(chunk: Buffer | string): void {
      for (const character of String(chunk)) {
        if (enterKeys.has(character)) {
          finish()
          return
        }
        if (character === interruptKey) {
          finish(new Error('Cancelled'))
          return
        }
        characters = backspaceKeys.has(character)
          ? characters.slice(0, -1)
          : [...characters, character]
      }
    }

    output.write(question)
    input.setRawMode(true)
    input.resume()
    input.on('data', onData)
  })
}
