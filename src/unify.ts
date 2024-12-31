import {
  type ASTNode,
  NameLambda,
  NameList,
  NameObject,
  NameTuple
} from "./ast";
import { prettyPrint, prettyPrintType } from "./print";
import {
  type MonoType,
  NameAny,
  NameConditional,
  NameGeneric,
  isTypeConst,
  isTypeVar,
  mapType
} from "./types";
import { plural } from "./utils";

export class TypeSubstitution {
  private _current: { [typeVar: string]: MonoType };

  constructor() {
    this._current = {};
  }

  _apply = (type: MonoType): MonoType => {
    return mapType((varName: string) => {
      const substType = this._current[varName];
      if (substType) return this._apply(substType);
      return undefined;
    }, type);
  };

  _unify = (
    type1: MonoType,
    type2: MonoType,
    typeVar?: string,
    node?: ASTNode
  ): void => {
    // console.log("unify", {
    //   type1: prettyPrintType(type1),
    //   type2: prettyPrintType(type2),
    //   typeVar,
    //   node: prettyPrint(node)
    // });
    if (type1 === type2) return;

    const t1 = this._apply(type1);
    const t2 = this._apply(type2);

    if (t1 === t2) {
      return;
    }
    if (t1.kind === NameAny || t2.kind === NameAny) return;
    if (isTypeVar(t1)) {
      // console.log({ t1, t2, current: JSON.stringify(this.current) });
      this._current[t1.type] = t2;
    } else if (isTypeVar(t2)) {
      this._unify(t2, t1, undefined, node);
    } else if (t1.kind === NameLambda && t2.kind === NameLambda) {
      if (t1.argTypes.length !== t2.argTypes.length) {
        // console.log({ t1, t2 });
        // @todo probably doesn't work if both t1 and t2 are variadic
        if (t1.argVariadic && t1.argTypes.length < t2.argTypes.length) {
          for (let i = t1.argTypes.length; i < t2.argTypes.length; i++)
            this._unify(t1.argVariadic, t2.argTypes[i], undefined, node);
        } else if (t2.argVariadic && t2.argTypes.length < t1.argTypes.length) {
          for (let i = t2.argTypes.length; i < t1.argTypes.length; i++)
            this._unify(t2.argVariadic, t1.argTypes[i], undefined, node);
        } else
          throw new Error(
            `Function expects ${plural(
              "argument",
              t1.argTypes.length,
              true
            )} (${t2.argTypes.length} provided) ${
              node ? `at ${prettyPrint(node)}` : ""
            }`
          );
      }
      for (let i = 0; i < t1.argTypes.length; i++) {
        this._unify(t1.argTypes[i], t2.argTypes[i], undefined, node);
      }
      this._unify(t1.returnType, t2.returnType, undefined, node);
    } else if (t1.kind === NameList && t2.kind === NameList) {
      this._unify(t1.elementType, t2.elementType, undefined, node);
    } else if (t1.kind === NameTuple && t2.kind === NameTuple) {
      if (t1.elementTypes.length !== t2.elementTypes.length)
        throw new Error(
          `Different arity for tuples: ${t1.elementTypes.length} vs ${t2.elementTypes.length}`
        );
      for (let i = 0; i < t1.elementTypes.length; i++)
        this._unify(t1.elementTypes[i], t2.elementTypes[i], undefined, node);
    } else if (t1.kind === NameObject && t2.kind === NameObject) {
      // console.log({
      //   step: "unify",
      //   t1: JSON.stringify(t1),
      //   t2: JSON.stringify(t2),
      //   type1,
      //   type2,
      // });
      const allKeys = new Set([
        ...Object.keys(t1.fields),
        ...Object.keys(t2.fields)
      ]);
      for (const key of allKeys) {
        if (key in t1.fields && key in t2.fields) {
          this._unify(t1.fields[key], t2.fields[key], undefined, node);
        } else if (key in t1.fields) {
          if (!t2.open)
            throw new Error(
              `Object field mismatch: ${key} missing in second type`
            );
        } else {
          if (!t1.open)
            throw new Error(
              `Object field mismatch: ${key} missing in first type`
            );
          // We update locally t1

          t1.fields[key] = t2.fields[key];
          // console.log({ step: "update", t1 });
        }
      }
      // Here, we need to update the previous var with potentially locally updated t1
      if (typeVar) this._current[typeVar] = t1;
    } else if (t1.kind === NameGeneric && t2.kind === NameGeneric) {
      this._unify(t1.baseType, t2.baseType, undefined, node);
      if (t1.typeArgs.length !== t2.typeArgs.length) {
        throw new Error(
          `Generic type arguments mismatch: ${t1.typeArgs.length} vs ${t2.typeArgs.length}`
        );
      }
      for (let i = 0; i < t1.typeArgs.length; i++) {
        this._unify(t1.typeArgs[i], t2.typeArgs[i], undefined, node);
      }
    } else if (t1.kind === NameConditional && t2.kind === NameConditional) {
      this._unify(t1.check.left, t2.check.left, undefined, node);
      this._unify(t1.check.right, t2.check.right, undefined, node);
      this._unify(t1.trueType, t2.trueType, undefined, node);
      this._unify(t1.falseType, t2.falseType, undefined, node);
    } else if (isTypeConst(t1) && isTypeConst(t2) && t1.type === t2.type) {
      return;
    } else {
      throw new Error(
        `Type mismatch: ${prettyPrintType(t1)} vs ${prettyPrintType(t2)} ${
          node ? ` at ${prettyPrint(node)}` : ""
        }`
      );
    }
  };
}
