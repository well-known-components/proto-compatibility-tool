import { runCommand } from "./helpers"

function test(args: string, ...exceptionMatch: RegExp[]) {
  const command = `./dist/bin.js --json ${args}`
  it(command, async () => {
    const { stdout, exitCode } = await runCommand(command, process.cwd(), process.env)
    const result: { errors: string[] } = JSON.parse(stdout)
    if (exceptionMatch && exceptionMatch.length) {
      if (result.errors.length == 0) {
        throw new Error("Did not throw" + JSON.stringify(result))
      }
      for (let matcher of exceptionMatch) {
        const found = result.errors.some(($) => $.match(matcher))
        if (!found) {
          throw new Error("No error matching " + exceptionMatch + " got: \n" + result.errors.join("\n"))
        }
      }
    } else {
      if (result.errors.length) {
        throw new Error("There was " + result.errors.length + " unexpected errors:\n" + result.errors.join("\n"))
      }
    }
  })
}

describe("file based", () => {
  test(`"test/folder-based/version-1.0.0/x.proto" "test/folder-based/version-1.0.0/x.proto"`)
  test(`"test/folder-based/version-1.0.0/x.proto" "test/folder-based/version-1.0.1/x.proto"`)
  test(
    `"test/folder-based/version-1.0.0/x.proto" "test/folder-based/version-2.0.0/x.proto"`,
    /The field hatSize was removed without adding a reservation to the type .twirp.example.haberdasher.Size/
  )
})

describe("pattern based", () => {
  test(`--recursive "test/folder-based/version-1.0.0" "test/folder-based"`, /no such file or directory/)
  test(`--recursive "test/folder-based/version-1.0.0" "test/folder-based/version-1.0.0"`)
  test(`--recursive "test/folder-based/version-1.0.0" "test/folder-based/version-1.0.1"`)
  test(
    `--recursive "test/folder-based/version-1.0.0" "test/folder-based/version-2.0.0"`,
    /The field hatSize was removed without adding a reservation to the type .twirp.example.haberdasher.Size/
  )
  test(
    `--recursive "test/folder-based/real-world/head" "test/folder-based/real-world/base"`,
    /The message .CRDTResponsea was removed/,
    /FieldId of field sceneId was changed 2 -> 1 from the type .PullCRDTRequest/,
    /Request message signature changed .CRDTResponsea -> .CRDTResponse for method .CRDTService.SendCrdt/
  )
})
