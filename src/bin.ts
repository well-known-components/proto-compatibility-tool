#!/usr/bin/env node

import fetch from "node-fetch"
import * as fs from "fs"
import * as lib from "./index"

export class UsageError extends Error {}
export class ValidationError extends Error {}

async function main() {
  const nonOptionArguments = process.argv.slice(2).filter(($) => !$.startsWith("-"))

  if (nonOptionArguments.length == 0) throw new UsageError("No <published file> was specified")
  if (nonOptionArguments.length == 1) throw new UsageError("No <local file> was specified")
  if (nonOptionArguments.length > 2) throw new UsageError("Found extra arguments, only two files can be specified")

  const [remote, local] = nonOptionArguments

  const remoteContent = await readFile(remote)
  const localContent = await readFile(local)

  const remoteRoot = lib.parse(remoteContent)
  const localRoot = lib.parse(localContent)

  remoteRoot.root.resolveAll()
  localRoot.root.resolveAll()

  const validationResult = lib.validateNewApiVersion(remoteRoot.root, localRoot.root)

  if (validationResult.errors.length) {
    const { errors } = validationResult

    console.log("\nErrors:")

    for (let err of errors) {
      console.log("- " + err.message)
    }

    console.log("")

    throw new ValidationError("Validation failed 🚨")
  }

  console.log("> Compatibility validation successful! ✅")
}

async function readFile(file: string) {
  console.log("> Loading file " + file)

  if (fs.existsSync(file)) {
    return fs.readFileSync(file).toString()
  }

  if (file.startsWith("http:") || file.startsWith("https:")) {
    const res = await fetch(file)
    if (!res.ok) throw new Error(`fetching ${file} failed`)
    return res.text()
  }

  throw new Error(`Cannot read file ${file}`)
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
