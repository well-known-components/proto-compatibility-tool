import { Enum, Namespace, NamespaceBase, OneOf, ReflectionObject, Root, roots, Service, Type } from "protobufjs"
export { parse, loadSync, Root, load } from "protobufjs"

/**
 * Compares two parsed and resolved protobuf roots
 * @public
 */
export function validateNewApiVersion(oldApi: Root, newApi: Root) {
  const errors: Error[] = []

  if (!oldApi.resolved) {
    errors.push(new Error(`First argument of validateNewApiVersion was not resolved`))
  }
  if (!newApi.resolved) {
    errors.push(new Error(`First argument of validateNewApiVersion was not resolved`))
  }

  validate(oldApi, newApi, errors)

  return { errors }
}

function isNamespaceBase(value: ReflectionObject): value is NamespaceBase {
  return `nestedArray` in value
}

function isNamespace(value: ReflectionObject): value is Namespace {
  return isNamespaceBase(value) && value instanceof Namespace
}

function isService(value: ReflectionObject): value is Service {
  return isNamespaceBase(value) && value instanceof Service
}

function isType(value: ReflectionObject): value is Type {
  return isNamespaceBase(value) && value instanceof Type
}

function isEnum(value: ReflectionObject): value is Enum {
  return value instanceof Enum || `valuesById` in value
}

function isOneOf(value: ReflectionObject): value is OneOf {
  return value instanceof OneOf || `oneof` in value
}

function isExtension(value: ReflectionObject): boolean {
  return `extend` in value && "id" in value
}

function validate(oldApi: NamespaceBase, newApi: NamespaceBase, errors: Error[]) {
  if (isNamespaceBase(oldApi) && isNamespaceBase(newApi)) {
    for (let oldChild of oldApi.nestedArray) {
      if (isService(oldChild)) {
        const newService = newApi.lookup(oldChild.name, Service) as Service
        if (!newService) {
          errors.push(new Error(`The service ${oldChild.fullName} was removed`))
        } else {
          validate(oldChild, newService, errors)
          validateService(oldChild, newService, errors)
        }
      } else if (isType(oldChild)) {
        const newType = newApi.lookup(oldChild.name, Type) as Type
        if (!newType) {
          errors.push(new Error(`The message ${oldChild.fullName} was removed`))
        } else {
          validate(oldChild, newType, errors)
          validateType(oldChild, newType, errors)
        }
      } else if (isEnum(oldChild)) {
        const newType = newApi.lookup(oldChild.name, Enum) as Enum
        if (!newType) {
          errors.push(new Error(`The enum ${oldChild.fullName} was removed`))
        } else {
          validateEnum(oldChild, newType, errors)
        }
      } else if (isNamespace(oldChild)) {
        const newNamespace = newApi.lookup(oldChild.name, Namespace) as NamespaceBase
        if (!newNamespace) {
          errors.push(new Error(`The namespace ${oldChild.fullName} was removed`))
        } else {
          validate(oldChild, newNamespace, errors)
        }
      } else if (isOneOf(oldChild)) {
        const newType = (newApi.nested || {})[oldChild.name]
        if (!newType) {
          errors.push(new Error(`The oneof ${oldChild.fullName} was removed`))
        }
      } else if (isExtension(oldChild)) {
        const newExtension = newApi.lookup(oldChild.name)
        if (!newExtension) {
          errors.push(new Error(`The extension ${oldChild.fullName} was removed`))
        }
      } else {
        errors.push(new Error(`Unhandled ` + JSON.stringify(oldChild) + " in " + oldApi.fullName))
      }
    }
  }
}

function wasDeprecated(obj: { options?: Record<any, any> }) {
  const t = (obj && obj.options && obj.options) || {}
  return t[`deprecated`] == true
}

function isReservedId(reserved: Array<string | number[]> | null, id: number | string) {
  if (reserved)
    for (var i = 0; i < reserved.length; ++i) {
      if (typeof reserved[i] !== `string` && reserved[i][0] <= id && reserved[i][1] >= id) return true
      if (typeof reserved[i] === `string` && typeof id == `string` && reserved[i] === id) return true
    }
  return false
}

function validateEnum(oldType: Enum, newType: Enum, errors: Error[]) {
  for (let oldId in oldType.valuesById) {
    const newValue = newType.valuesById[oldId]
    if (!newValue) {
      // find a new `reserved` field
      const isNowReserved = isReservedId(newType.reserved, oldId)
      if (!isNowReserved) {
        errors.push(
          new Error(
            `The enum value ${oldType.valuesById[oldId]}=${oldId} was removed without adding a reservation to the enum ${oldType.fullName}`
          )
        )
      }
    }
  }

  if (oldType.reserved) {
    for (let reservation of oldType.reserved) {
      if (typeof reservation == `string`) {
        // noop?
        errors.push(new Error(`Unhandler error in enum string reservation in enum ${oldType.fullName}`))
      } else {
        if (reservation[0] == reservation[1]) {
          if (!newType.isReservedId(reservation[0])) {
            errors.push(
              new Error(`The reserved enum value ${reservation[0]} was removed from the enum ${oldType.fullName}`)
            )
          }
        } else {
          errors.push(new Error(`Range reservations are not allowed`))
        }
      }
    }
  }
}

function validateType(oldType: Type, newType: Type, errors: Error[]) {
  for (let oldField of oldType.fieldsArray) {
    const newField = newType.fields[oldField.name]
    if (!newField) {
      // find a new `reserved` field
      const isNowReserved = isReservedId(newType.reserved, oldField.id)
      if (!isNowReserved) {
        errors.push(
          new Error(
            `The field ${oldField.name} was removed without adding a reservation to the type ${oldType.fullName}`
          )
        )
      }
    } else {
      if (oldField.type != newField.type) {
        errors.push(
          new Error(
            `Type of field ${oldField.name} was changed ${oldField.type} -> ${newField.type} from the type ${oldType.fullName}`
          )
        )
      }
      if (oldField.id != newField.id) {
        errors.push(
          new Error(
            `FieldId of field ${oldField.name} was changed ${oldField.id} -> ${newField.id} from the type ${oldType.fullName}`
          )
        )
      }
      if (!!oldField.optional != !!newField.optional) {
        errors.push(
          new Error(
            `Optional of field ${
              oldField.name
            } was changed ${!!oldField.optional} -> ${!!newField.optional} from the type ${oldType.fullName}`
          )
        )
      }
      if (!!oldField.required != !!newField.required) {
        errors.push(
          new Error(
            `Required of field ${
              oldField.name
            } was changed ${!!oldField.required} -> ${!!newField.required} from the type ${oldType.fullName}`
          )
        )
      }
    }
  }

  function hasReservedId(type: Type, id: number) {
    if (type.reserved) {
      for (let reserved of type.reserved) {
        if (reserved[0] >= id && id <= reserved[1]) return true
      }
    }
    return false
  }

  if (oldType.reserved) {
    for (let reservation of oldType.reserved) {
      if (typeof reservation == `string`) {
        throw new Error(`How to handle string reservations?`)
      } else {
        for (let r = Math.min(reservation[0], reservation[1]); r <= Math.max(reservation[0], reservation[1]); r++) {
          if (!hasReservedId(newType, r)) {
            errors.push(new Error(`The reserved field ${r} was removed from the type ${newType.fullName}`))
          }
        }
      }
    }
  }
}

function validateService(oldType: Service, newType: Service, errors: Error[]) {
  for (let oldMethod of oldType.methodsArray) {
    const newMethod = newType.methods[oldMethod.name]

    if (!newMethod) {
      // find a new `reserved` field
      if (!wasDeprecated(oldMethod)) {
        errors.push(new Error(`The method ${oldMethod.name} was removed without being deprecated first.`))
      }
    } else {
      if (!oldMethod.resolvedRequestType) {
        errors.push(new Error(`Could not resolve request type for method ${oldMethod.fullName}`))
      } else if (!newMethod.resolvedRequestType) {
        errors.push(new Error(`Could not resolve request type for method ${oldMethod.fullName}`))
      } else {
        if (oldMethod.resolvedRequestType.fullName != newMethod.resolvedRequestType.fullName) {
          errors.push(
            new Error(
              `Request message signature changed ${oldMethod.resolvedRequestType.fullName} -> ${newMethod.resolvedRequestType.fullName} for method ${oldMethod.fullName}`
            )
          )
        }
        validateType(oldMethod.resolvedRequestType, newMethod.resolvedRequestType, errors)
      }
      if (!oldMethod.resolvedResponseType) {
        errors.push(new Error(`Could not resolve response type for method ${oldMethod.fullName}`))
      } else if (!newMethod.resolvedResponseType) {
        errors.push(new Error(`Could not resolve response type for method ${oldMethod.fullName}`))
      } else {
        if (oldMethod.resolvedResponseType.fullName != newMethod.resolvedResponseType.fullName) {
          errors.push(
            new Error(
              `Request message signature changed ${oldMethod.resolvedResponseType.fullName} -> ${newMethod.resolvedResponseType.fullName} for method ${oldMethod.fullName}`
            )
          )
        }
        validateType(oldMethod.resolvedResponseType, newMethod.resolvedResponseType, errors)
      }
      if (oldMethod.requestStream != newMethod.requestStream) {
        errors.push(
          new Error(
            `Request type of method ${oldMethod.fullName} should ${oldMethod.requestStream ? `` : `not `} be streamable`
          )
        )
      }
      if (oldMethod.responseStream != newMethod.responseStream) {
        errors.push(
          new Error(
            `Request type of method ${oldMethod.fullName} should ${oldMethod.responseStream ? `` : `not `}be streamable`
          )
        )
      }
    }
  }
}
