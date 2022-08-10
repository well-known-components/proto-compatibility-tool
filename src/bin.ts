#!/usr/bin/env node

import fetch from "node-fetch"
import * as fs from "fs"
import * as path from "path"
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

  const [remote, local] = nonOptionArguments

  const JSON_OUTPUT = optionArguments.includes("--json")
  const RECURSIVE = optionArguments.includes("--recursive")

  const result: { errors: Error[]; fixtures: [string, string][] } = { errors: [], fixtures: [] }

  if (RECURSIVE) {
    const remoteFiles = glob.sync("**/*.proto", { cwd: remote, absolute: false })
    for (const remoteFile of remoteFiles) {
      const lhs = path.resolve(remote, remoteFile)
      const rhs = path.resolve(local, remoteFile)

      result.fixtures.push([lhs, rhs])
    }
  } else {
    result.fixtures.push([remote, local])
  }

  if (!result.fixtures) {
    result.errors.push(new ValidationError("Matching files for comparision not found"))
  }

  for (const [remote, local] of result.fixtures) {
    try {
      const remoteContent = await readFile(remote)
      const localContent = await readFile(local)

      const remoteRoot = lib.parse(remoteContent)
      const localRoot = lib.parse(localContent)

      remoteRoot.root.resolveAll()
      localRoot.root.resolveAll()

      const validationResult = lib.validateNewApiVersion(remoteRoot.root, localRoot.root)

      result.errors.push(...validationResult.errors)
    } catch (err: any) {
      result.errors.push(err)
    }
  }

  if (JSON_OUTPUT) {
    const json = {
      errors: result.errors.map(($) => $.message),
    }
    process.stdout.write(JSON.stringify(json, null, 2) + "\n")
    process.exitCode = result.errors.length ? 1 : 0
    return
  }

  if (result.errors.length) {
    console.log("\nErrors:")

    for (let err of result.errors) {
      console.log("- " + err.message)
    }

    console.log("")

    throw new ValidationError("Validation failed 🚨")
  }

  console.log("> Compatibility validation successful! ✅")
}

async function readFile(file: string) {
  process.stderr.write("> Loading file " + file + "\n")

  if (fs.existsSync(file)) {
    return fs.readFileSync(file).toString()
  }

  if (file.startsWith("http:") || file.startsWith("https:")) {
    const res = await fetch(file)
    if (!res.ok) throw new Error(`fetching ${file} failed`)
    return res.text()
  }

  throw new ValidationError(`Cannot read file ${file}`)
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
