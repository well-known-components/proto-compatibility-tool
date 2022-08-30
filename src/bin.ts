#!/usr/bin/env node

import * as fs from "fs"
import * as path from "path"
import * as pbjspath from "@protobufjs/path"
import * as lib from "./index"
import { glob } from "glob"

export class UsageError extends Error {}
export class ValidationError extends Error {}

async function main() {
  const nonOptionArguments = process.argv.slice(2).filter(($) => !$.startsWith("-"))
  const optionArguments = process.argv.slice(2).filter(($) => $.startsWith("-"))

  if (nonOptionArguments.length == 0) throw new UsageError("No <published file> was specified")
  if (nonOptionArguments.length == 1) throw new UsageError("No <local file> was specified")
  if (nonOptionArguments.length > 2) throw new UsageError("Found extra arguments, only two files can be specified")

  const JSON_OUTPUT = optionArguments.includes("--json")
  const RECURSIVE = optionArguments.includes("--recursive")

  const result: {
    errors: string[]
    fixtures: { remoteCwd: string; localCwd: string; remoteFile: string; localFile: string }[]
  } = { errors: [], fixtures: [] }

  {
    const [remote, local] = nonOptionArguments
    if (RECURSIVE) {
      // compare local files against remote files
      const remoteFiles = glob.sync("**/*.proto", { cwd: remote, absolute: false })
      for (const remoteFile of remoteFiles) {
        result.fixtures.push({ remoteCwd: remote, localCwd: local, remoteFile, localFile: remoteFile })
      }
      // then compare NEW local files that are not present in the remote
      const localFiles = glob.sync("**/*.proto", { cwd: local, absolute: false })
      for (const localFile of localFiles) {
        if (!result.fixtures.find(($) => $.localFile == localFile)) {
          result.fixtures.push({ remoteCwd: local, localCwd: local, remoteFile: localFile, localFile: localFile })
        }
      }
    } else {
      result.fixtures.push({ remoteCwd: ".", localCwd: ".", remoteFile: remote, localFile: local })
    }
  }

  if (!result.fixtures.length) {
    result.errors.push("Matching files for comparision not found")
  }

  for (const fixture of result.fixtures) {
    try {
      const remoteRoot = new lib.Root()
      const localRoot = new lib.Root()

      localRoot.resolvePath = remoteRoot.resolvePath = function (origin: string, target: string) {
        const resolved = pbjspath.resolve(origin, target)
        if (target.startsWith("google/") && !fs.existsSync(resolved)) {
          return pbjspath.resolve(require.resolve("protobufjs/package.json"), target)
        }
        return resolved
      }

      await remoteRoot.load(path.resolve(fixture.remoteCwd, fixture.remoteFile))
      await localRoot.load(path.resolve(fixture.localCwd, fixture.localFile))

      remoteRoot.root.resolveAll()
      localRoot.root.resolveAll()

      const validationResult = lib.validateNewApiVersion(remoteRoot.root, localRoot.root)

      result.errors.push(...validationResult.errors.map(($) => $.message))
    } catch (err: any) {
      result.errors.push(err.message + " (in " + fixture.remoteFile + ")")
    }
  }

  if (JSON_OUTPUT) {
    const json = {
      fixtures: result.fixtures,
      errors: Array.from(new Set<string>(result.errors)),
    }
    process.stdout.write(JSON.stringify(json, null, 2) + "\n")
    process.exitCode = result.errors.length ? 1 : 0
    return
  }

  console.log("\nChecked:")

  for (let fixture of result.fixtures) {
    const local = path.relative(process.cwd(), path.resolve(fixture.localCwd, fixture.localFile))
    const remote = path.relative(process.cwd(), path.resolve(fixture.remoteCwd, fixture.remoteFile))
    console.log("- " + local)
    if (local != remote) {
      console.log("  " + remote)
    }
  }

  if (result.errors.length) {
    console.log("\nErrors:")
    const errs = new Set<string>(result.errors)
    for (let err of errs) {
      console.log("- " + err)
    }

    console.log("")

    throw new ValidationError("Validation failed 🚨")
  }

  console.log("> Compatibility validation successful! ✅")
}

main().catch(($) => {
  if ($ instanceof UsageError) {
    console.log(`
Error in arguments:
  ${$.message}

Usage:
  proto-compatibility-tool <published file> <local file>

    <published file> = File that was published in a previous version
    <local file> = File to compare with, the new version
`)
  } else if ($ instanceof ValidationError) {
    console.log($.message)
  } else {
    console.error($)
  }
  process.exit(1)
})
