import { validateNewApiVersion } from "../src"
import { parse } from "protobufjs"

function test(description: string, src: string, ...exceptionMatch: RegExp[]) {
  it(description, () => {
    const sanitized = src.trim().replace(/^\s+/gm, "")

    const initialSrc = sanitized.replace(/^(\-)/gm, "").replace(/^(\+.*)$/gm, "")
    const finalSrc = sanitized.replace(/^(\+)/gm, "").replace(/^(\-.*)$/gm, "")

    const initialRoot = parse('syntax = "proto3";' + initialSrc)
    const finalRoot = parse('syntax = "proto3";' + finalSrc)

    initialRoot.root.resolveAll()
    finalRoot.root.resolveAll()

    const result = validateNewApiVersion(initialRoot.root, finalRoot.root)

    if (exceptionMatch && exceptionMatch.length) {
      if (result.length == 0) {
        throw new Error("Did not throw")
      }
      for (let matcher of exceptionMatch) {
        const found = result.some(($) => $.message.match(matcher))
        if (!found) {
          throw new Error("No error matching " + exceptionMatch + " got: \n" + result.join("\n"))
        }
      }
    } else {
      if (result.length) {
        throw new Error("There was " + result.length + " unexpected errors:\n" + result.join("\n"))
      }
    }
  })
}

describe("unit", () => {
  test(
    "Messages work",
    `
    message MessageName {
      int32 message_id = 1;
    }
    `
  )
  test(
    "Adding fields to messages work",
    `
    message MessageName {
      int32 message_id = 1;
   +  required string message_payload = 2;
    }
    `
  )
  test(
    "Adding reserved fields work",
    `
    message MessageName {
      int32 message_id = 1;
   +  reserved 2;
    }
    `
  )
  test(
    "Removing required fields throws",
    `
    message MessageName {
      int32 message_id = 1;
   -  required string message_payload = 2;
    }
    `,
    /The field messagePayload was removed without adding a reservation/
  )
  test(
    "Removing optional fields throws if the number of the field is not reserved",
    `
    message MessageName {
      int32 message_id = 1;
   -  string message_payloada = 2;
   +  reserved 2;
    }
    `
  )
  test(
    "Changing type throws",
    `
    message MessageName {
      int32 message_id = 1;
   -  string message_payload = 2;
   +  int32 message_payload = 2;
    }
    `,
    /Type of field messagePayload was changed string -> int32/
  )
  test(
    "Removing reserved fields throws an exception",
    `
    message MessageName {
      int32 message_id = 1;
   -  reserved 2;
    }
    `,
    /The reserved field 2 was removed/
  )
  test(
    "Adding reservations should work",
    `
    message MessageName {
      int32 message_id = 1;
   +  reserved 2;
    }
    `
  )
  test(
    "Enum types should work",
    `
    enum Corpus { UNIVERSAL = 0; }
    `
  )
  test(
    "Adding enum types should work",
    `
    +enum Corpus { UNIVERSAL = 0; }
    `
  )
  test(
    "Adding enum elements should work",
    `
    enum Corpus {
      UNIVERSAL = 0;
   +  TEST = 1;
    }
    `
  )
  test(
    "Adding enum reservations should work",
    `
    enum Corpus {
      UNIVERSAL = 0;
   +  reserved 2;
    }
    `
  )

  test(
    "Removing value from enum reservations should fail",
    `
    enum Corpus {
      UNIVERSAL = 0;
   -  TEST = 1;
    }
    `,
    /The enum value TEST=1 was removed without adding a reservation/
  )
  test(
    "Removing value from enum reservations should fail, nested enum",
    `
    message TestMessage {
      enum Corpus {
        UNIVERSAL = 0;
   -    TEST = 1;
      }
      Corpus a = 1;
    }
    `,
    /The enum value TEST=1 was removed without adding a reservation/
  )
  test(
    "Removing value from enum reservations should fail, nested enum",
    `
    message TestMessage {
      enum CorpusA {
        UNIVERSAL = 0;
      }
      enum CorpusB {
        UNIVERSAL = 0;
      }
      -CorpusA a = 1;
      +CorpusB a = 1;
    }
    `,
    /Type of field a was changed CorpusA -> CorpusB/
  )
  test(
    "Types checking ignores if enums are moved to other scopes",
    `
    +enum CorpusA { UNIVERSAL = 0; }
    message TestMessage {
      -enum CorpusA { UNIVERSAL = 0; }
      CorpusA a = 1;
    }
    `
  )

  test(
    "Removing value from enum reservations should work if adding reservation",
    `
    enum Corpus {
      UNIVERSAL = 0;
   -  TEST = 1;
   +  reserved 1;
    }
    `
  )

  test(
    "Changing enum value name should work",
    `
    enum Corpus {
      UNIVERSAL = 0;
   -  ASD = 1;
   +  PROPERNAME = 1;
    }
    `
  )

  test(
    "Services work",
    `
    message Size {}
    message Hat {}
    service Haberdasher {
      rpc MakeHat(Size) returns (Hat);
    }
    `
  )
  test(
    "Adding methods work",
    `
    message Size {}
    message Hat {}
    service Haberdasher {
      rpc MakeHat(Size) returns (Hat);
   +  rpc MakeHat2(Size) returns (Hat);
    }
    `
  )
  test(
    "Removing methods from services throws",
    `
    message Size {}
    message Hat {}
    service Haberdasher {
   -  rpc MakeHat(Size) returns (Hat);
    }
    `,
    /The method MakeHat was removed without being deprecated first/
  )
  test(
    "Removing deprecated methods from services does not throw",
    `
    message Size {}
    message Hat {}
    service Haberdasher {
   -  rpc MakeHat(Size) returns (Hat) { option deprecated = true; };
    }
    `
  )
  test(
    "Renaming methods from services throws",
    `
    message Size {}
    message Hat {}
    service Haberdasher {
   -  rpc MakeHat(Size) returns (Hat);
   +  rpc MakeTophat(Size) returns (Hat);
    }
    `,
    /The method MakeHat was removed/
  )
  test(
    "Changing signatures in services methods throws",
    `
    message Size {}
    message HatOptions {}
    message Hat {}
    service Haberdasher {
   -  rpc MakeHat(Size) returns (Hat);
   +  rpc MakeHat(HatOptions) returns (Hat);
    }
    `,
    /Request message signature changed .Size -> .HatOptions for method .Haberdasher.MakeHat/
  )
  test(
    "Removing service throws",
    `
    message Size {}
    message Hat {}
   -service Haberdasher {
   - rpc MakeHat(Size) returns (Hat);
   -}
    `,
    /The service .Haberdasher was removed/
  )
  test(
    "Renaming service throws",
    `
    message Size {}
    message Hat {}
   -service Haberdasher {
   +service HaberdasherABC {
      rpc MakeHat(Size) returns (Hat);
    }
    `,
    /The service .Haberdasher was removed/
  )
  test(
    "Packages work",
    `
    package twirp.example.haberdasher;
    message Size {}
    `
  )
  test(
    "Removing package throws",
    `
   -package twirp.example.haberdasherX;
    message Size {}
    `,
    /The namespace .twirp was removed/
  )
  test(
    "Changing package throws",
    `
   -package twirp.example.haberdasher;
   +package twirp.example.haberdasherABC;

    message Size {}
    `,
    /The namespace .twirp.example.haberdasher was removed/
  )
  test(
    "Removing message throws",
    `
   -message Size {}
    `,
    /The message .Size was removed/
  )
})
