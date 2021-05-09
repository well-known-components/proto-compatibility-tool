# proto-compatibility-tool

`proto-compatibility-tool` is an utility that verifies .proto files and ensures backwards compatibility to prevent breaking changes on exposed APIs.

It runs as part of the CI process, and runs verifications agains published versions of .proto files in NPM packages.

## Design

Types are evaluated nominally and then structurally. That means, this tool not only checks the structure and serialization of each message, it also checks that the name of the types matches to not break any generated code.

## Valdiations

### Removing required fields throws an exception

```diff
message MessageName {
  int32 message_id = 1;
- required string message_payload = 2;
}
// 🚨 Throws
```

### Removing optional fields throws if the number of the field is not reserved

```diff
message MessageName {
  int32 message_id = 1;
- string message_payload = 2;
+ reserved 2;
}
// ✅ Passes
```

### Changing type throws

```diff
message MessageName {
  int32 message_id = 1;
- string message_payload = 2;
+ int32 message_payload = 2;
}
// 🚨 Throws
```

### Removing reserved fields throws an exception.

Fields are optional by default, field removal should be performed very few times during the development lifecycle. Once you remove a field there is no looking back, because this tool will verify against the previous published version, re-validating the field original type is not possible.

```diff
message MessageName {
  int32 message_id = 1;
- reserved 2;
}
// 🚨 Throws
```

### Removing methods from services throws

```diff
service Haberdasher {
-  rpc MakeHat(Size) returns (Hat);
}
// 🚨 Throws
```

### Removing deprecated methods from services does not throw

```diff
service Haberdasher {
-  rpc MakeHat(Size) returns (Hat) [deprecated = true];
}
// ✅ Passes
```

### Renaming methods from services throws

```diff
service Haberdasher {
-  rpc MakeHat(Size) returns (Hat);
+  rpc MakeTophat(Size) returns (Hat);
}
// 🚨 Throws
```

### Changing signatures in services methods throws

If a function receives different input or produces a different result, it is a different function, therefore it must have a different name.

```diff
service Haberdasher {
-  rpc MakeHat(Size) returns (Hat);
+  rpc MakeHat(HatOptions) returns (Hat);
}
// 🚨 Throws
```

### Changing or removing package throws

```diff

-package twirp.example.haberdasher;
+package twirp.example.hats;

service Haberdasher {
...
}
// 🚨 Throws
```

### Renaming services throw

```diff
-service Haberdasher {
+service Hats {
  rpc MakeHat(Size) returns (Hat);
}
// 🚨 Throws
```