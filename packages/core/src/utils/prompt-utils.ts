import type inquirer from 'inquirer'
import type { Key } from 'readline'

export async function wrapEscHandler<T>(prompt: ReturnType<typeof inquirer.prompt>) {
  const escListener = (_: string, key: Key) => {
    if (key.name === 'escape' || key.name === 'SIGINT') {
      prompt.ui.close()
      cleanup()
    }
  }

  const cleanup = () => {
    process.stdin.removeListener('keypress', escListener)
  }

  process.stdin.on('keypress', escListener)

  try {
    const result = await prompt
    cleanup()
    return result as T
  } catch (err) {
    cleanup()
    throw err
  }
}
