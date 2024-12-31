import {
  type ASTNode,
  type FieldNode,
  NameApplication,
  NameConstant,
  NameField,
  NameLambda,
  NameList,
  NameObject,
  NameTuple,
  NameVariable
} from "./ast";
import type { Environment } from "./env";
import type { ParserExtension } from "./highLevel";
import { prettyPrint, prettyPrintType } from "./print";
import { Rational } from "./rational";
import {
  Instantiate,
  type TypeScheme,
  TypeSchemeOfMonoType
} from "./typeScheme";
import { type MonoType, newTypeConst, newTypeVar } from "./types";
import { TypeSubstitution } from "./unify";

export const detectConstantType = (
  v: boolean | string | Rational,
  extensions: ParserExtension<unknown, string>[] = []
): "boolean" | "string" | "number" | (typeof extensions)[number]["elt"] => {
  if (v instanceof Rational) return "number";
  for (const ext of extensions)
    if (ext.instance(v)) {
      // if (!ext.type) console.log("AAA detectConstantType", { ext });
      return ext.type.type;
    }
  return typeof v;
};

export const inferType =
  (env: Environment) =>
  async (node: ASTNode): Promise<TypeScheme> => {
    const subst = new TypeSubstitution();
    const aux = async (env: Environment, node: ASTNode): Promise<MonoType> => {
      switch (node.type) {
        case NameConstant: {
          const ty = detectConstantType(
            node.value as string,
            env?.options?.extensions
          );
          // console.log("AAA inferType", { ty, options: env?.options });
          return newTypeConst(ty);
        }

        case NameVariable: {
          const built = env.library(node.name);
          // @todo should we check in the standard library first
          if (built) {
            return Instantiate(built.t);
          }
          const typeScheme = env.type(node.name);
          if (!typeScheme) {
            throw new Error(`Unbound variable: ${node.name}`);
          }
          return Instantiate(typeScheme);
        }

        case NameApplication: {
          const fn = await aux(env, node.function);

          const returnTypeVar = newTypeVar("r");
          subst._unify(
            fn,
            {
              kind: NameLambda,
              argTypes: await Promise.all(
                node.params.map((param) => aux(env, param))
              ),
              returnType: returnTypeVar
            },
            undefined,
            node
          );
          return subst._apply(returnTypeVar);
        }

        case NameList: {
          const elementTypeVar = newTypeVar("e");
          for (const element of node.elements) {
            const elementType = await aux(env, element);
            // console.log({ elementTypeVar, elementType });
            subst._unify(elementType, elementTypeVar, undefined, node);
          }
          return subst._apply({ kind: NameList, elementType: elementTypeVar });
        }

        case NameTuple: {
          const elementTypes = await Promise.all(
            node.elements.map((el) => aux(env, el))
          );
          return subst._apply({ kind: NameTuple, elementTypes });
        }

        case NameObject: {
          const fields: { [key: string]: MonoType } = {};
          for (const key in node.values) {
            fields[key] = await aux(env, node.values[key]);
          }
          return { kind: NameObject, fields, open: false };
        }

        case NameField: {
          const exprType = await aux(env, node.expr);
          const fieldType =
            "field" in node ? node.field : await aux(env, node.sub);
          const isNumber =
            typeof fieldType !== "string" &&
            fieldType.kind === "const" &&
            fieldType.type === "number";
          // console.log({ exprType, apply: subst.apply(exprType) });
          if (
            !(exprType.kind === NameObject && !isNumber) &&
            !(exprType.kind === NameList && isNumber) &&
            // not yet resolved
            exprType.kind !== NameVariable
          ) {
            throw new Error(
              `In ${prettyPrint(node)}: Expected ${
                isNumber ? "a list" : "an object"
              } or variable, got ${exprType.kind}`
            );
          }

          if (typeof fieldType !== "string" && !isNumber) {
            throw new Error(
              `In ${prettyPrint(node)}: Expected a field ${
                isNumber ? "index" : "name"
              }, got ${prettyPrintType(fieldType)}`
            );
          }
          if (exprType.kind === NameVariable) {
            if (!isNumber && !("field" in node))
              throw new Error(`No field in ${prettyPrint(node)}`);
            // console.log({
            //   step: "first time",
            //   field: node.field,
            //   subst,
            //   exprType: JSON.stringify(exprType),
            // });
            const parameterType = newTypeVar("f");
            subst._unify(
              exprType,
              isNumber
                ? { kind: NameList, elementType: parameterType }
                : {
                    kind: NameObject,
                    fields: {
                      [(node as FieldNode & { field: string }).field]:
                        parameterType
                    },
                    open: true
                  },
              exprType.type, // we explicitly tell to update the exprType in substitution
              node
            );
            return subst._apply(parameterType);
          }
          if (isNumber) {
            // @ts-expect-error exprType.kind === NameList
            return subst._apply(exprType.elementType);
          }
          // @ts-expect-error exprType.kind === NameObject
          if (!(fieldType in exprType.fields)) {
            // console.log("second time");
            // console.log({ exprType: JSON.stringify(exprType) });
            // @ts-expect-error exprType.kind === NameObject
            if (!exprType.open)
              throw new Error(
                `In ${prettyPrint(node)}: Unknown field: ${fieldType}`
              );
            // Assign a new type variable to the unknown field
            // FIXME: HERE update the field and propagate
            const parameterType = newTypeVar("ff");
            // exprType.fields[fieldType] = newTypeVar(`field_${fieldType}`);
            subst._unify(
              exprType,
              {
                kind: NameObject,
                // @ts-expect-error exprType.kind === NameObject
                fields: { [fieldType]: parameterType },
                open: true
              },
              undefined,
              node
            );
            return subst._apply(parameterType);
          }
          // @ts-expect-error exprType.kind === NameObject
          return subst._apply(exprType.fields[fieldType]);
        }

        case NameLambda: {
          const parameterType = newTypeVar("a");
          const ts = { vars: [], type: parameterType };
          const bodyType = await aux(
            // We temporarily update the environment with the type variable for
            // the lambda bound variable.
            env.withType(node.parameter, ts),
            node.body
          );
          return {
            kind: NameLambda,
            argTypes: [subst._apply(parameterType)],
            returnType: subst._apply(bodyType)
          };
        }

        default:
          throw new Error(`Unknown node type: ${prettyPrint(node)}`);
      }
    };

    const result = await aux(env, node);

    // Sanity check: there should be no type variable in result that
    // appear in the substitution
    const substitutedResult = subst._apply(result);
    // @todo check MonoType equality
    if (substitutedResult !== result) {
      // If this happens, it means a subst._apply call may have been forgotten
      // or we need a better unification algorithm
      throw new Error(
        `In ${prettyPrint(
          node
        )}: Non-substituted free variable in ${prettyPrintType(result)}`
      );
    }

    return TypeSchemeOfMonoType(result);
  };
