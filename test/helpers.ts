import { exec } from "child_process"

export function runCommand(
  command: string,
  cwd: string,
  env?: Record<string, string>
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise<{ exitCode: number; stdout: string; stderr: string }>((onSuccess, onError) => {
    process.stdout.write("∑ " + cwd + "; " + command + "\n")
    exec(command, { cwd, env }, (error, stdout, stderr) => {
      stdout.trim().length && process.stdout.write("  " + stdout.replace(/\n/g, "\n  ") + "\n")
      stderr.trim().length && process.stderr.write("! " + stderr.replace(/\n/g, "\n  ") + "\n")

      onSuccess({ exitCode: error?.code || 0, stdout, stderr })
    })
  })
}

export function itExecutes(command: string, cwd: string, env?: Record<string, string>) {
  it(command, async () => await runCommand(command, cwd, env)).timeout(60000)
}
