// adapted from https://github.com/lezer-parser/julia
// license: MIT

import { ExternalTokenizer } from "@lezer/lr";

import * as terms from "./λs.terms.js";

// UNICODE CODEPOINTS

const CHAR_DOT = ".".codePointAt(0);
const CHAR_BACKSLASH = "\\".codePointAt(0);
const CHAR_BACKQUOTE = "`".codePointAt(0);
const CHAR_DOLLAR = "$".codePointAt(0);
const CHAR_HASH = "#".codePointAt(0);
const CHAR_LPAREN = "(".codePointAt(0);
const CHAR_LBRACKET = "[".codePointAt(0);
const CHAR_SEMICOLON = ";".codePointAt(0);
const CHAR_DQUOTE = '"'.codePointAt(0);
const CHAR_NEWLINE = "\n".codePointAt(0);
const CHAR_A = "A".codePointAt(0);
const CHAR_Z = "Z".codePointAt(0);
const CHAR_a = "a".codePointAt(0);
const CHAR_z = "z".codePointAt(0);
const CHAR_0 = "0".codePointAt(0);
const CHAR_9 = "9".codePointAt(0);
const CHAR_UNDERSCORE = "_".codePointAt(0);
const CHAR_AT = "@".codePointAt(0);

// UNICODE CATEGORIES TESTS

const CAT_Lu = /^\p{Lu}/u;
const CAT_Ll = /^\p{Ll}/u;
const CAT_Lt = /^\p{Lt}/u;
const CAT_Lm = /^\p{Lm}/u;
const CAT_Lo = /^\p{Lo}/u;
const CAT_Me = /^\p{Me}/u;
const CAT_Mn = /^\p{Mn}/u;
const CAT_Mc = /^\p{Mc}/u;
const CAT_Nd = /^\p{Nd}/u;
const CAT_Nl = /^\p{Nl}/u;
const CAT_No = /^\p{No}/u;
const CAT_Pc = /^\p{Pc}/u;
const CAT_Sc = /^\p{Sc}/u;
const CAT_Sk = /^\p{Sk}/u;
const CAT_So = /^\p{So}/u;
const CAT_Emoji = /^\p{Emoji}/u;

// TERMINATOR

export const terminator = new ExternalTokenizer((input, stack) => {
  const c = input.peek(0);
  if (c === CHAR_NEWLINE || c === CHAR_SEMICOLON) {
    if (stack.canShift(terms.terminator)) {
      input.acceptToken(terms.terminator, 1);
      return;
    }
  }
});

// IDENTIFIER
// See https://github.com/JuliaLang/julia/blob/8218480f059b7d2ba3388646497b76759248dd86/src/flisp/julia_extensions.c#L67-L152

function isIdentifierStartCharExtra(s, c) {
  return (
    CAT_Lu.test(s) ||
    CAT_Ll.test(s) ||
    CAT_Lt.test(s) ||
    CAT_Lm.test(s) ||
    CAT_Lo.test(s) ||
    CAT_Nl.test(s) ||
    CAT_Sc.test(s) || // allow currency symbols
    CAT_Emoji.test(s) || // allow emoji
    // other symbols, but not arrows or replacement characters
    (CAT_So.test(s) &&
      !(c >= 0x2190 && c <= 0x21ff) &&
      c !== 0xfffc &&
      c !== 0xfffd &&
      c !== 0x233f && // not slash
      c !== 0x00a6) // broken bar
  );
}

function isIdentifierStartChar(input, offset) {
  const c = input.peek(offset);
  if (
    (c >= CHAR_A && c <= CHAR_Z) ||
    (c >= CHAR_a && c <= CHAR_z) ||
    c === CHAR_UNDERSCORE ||
    c === CHAR_DOLLAR ||
    c === CHAR_AT
  )
    return 1;
  if (c < 0xa1 || c > 0x10ffff) return 0;
  const s = combineSurrogates(input, offset);
  if (isIdentifierStartCharExtra(s, c)) return s.length;
  return 0;
}

/**
 * Return a string at current position by combining surrogate code points.
 */
function combineSurrogates(input, offset) {
  let eat = 1;
  let c = input.peek(offset);
  let s = String.fromCodePoint(c);
  while (true) {
    const nc = input.peek(offset + eat);
    // Break if c and nc are not surrogate pairs
    if (!(0xd800 <= c && c <= 0xdbff && 0xdc00 <= nc && nc <= 0xdfff)) {
      break;
    }
    s = s + String.fromCodePoint(nc);
    c = nc;
    eat = eat + 1;
  }
  return s;
}

export const Identifier = new ExternalTokenizer((input, stack) => {
  let start = true;
  const ok = true;
  let offset = 0;
  let eat = 1;
  while (true) {
    const c = input.peek(offset);
    if (c === -1) break;
    if (start) {
      start = false;
      eat = isIdentifierStartChar(input, offset);
      if (eat === 0) {
        break;
      }
    } else {
      if (
        (c >= CHAR_A && c <= CHAR_Z) ||
        (c >= CHAR_a && c <= CHAR_z) ||
        (c >= CHAR_0 && c <= CHAR_9) ||
        c === CHAR_UNDERSCORE
      ) {
        // accept
      } else if (c < 0xa1 || c > 0x10ffff) {
        break;
      } else {
        const s = combineSurrogates(input, offset);
        eat = s.length;
        if (isIdentifierStartCharExtra(s, c)) {
          // accept
        } else if (
          CAT_Mn.test(s) ||
          CAT_Mc.test(s) ||
          CAT_Nd.test(s) ||
          CAT_Pc.test(s) ||
          CAT_Sk.test(s) ||
          CAT_Me.test(s) ||
          CAT_No.test(s) ||
          // primes (single, double, triple, their reverses, and quadruple)
          (c >= 0x2032 && c <= 0x2037) ||
          c === 0x2057
        ) {
          // accept
        } else {
          break;
        }
      }
    }
    offset = offset + eat;
    eat = 1;
  }
  if (offset !== 0) {
    input.acceptToken(terms.Identifier, offset);
  }
});

// STRING TOKENIZERS

const isStringInterpolation = (input, offset) => {
  const c = input.peek(offset);
  const nc = input.peek(offset + 1);
  return (
    c === CHAR_HASH &&
    (isIdentifierStartChar(input, offset + 1) !== 0 || nc === CHAR_LPAREN)
  );
};

const makeStringContent = ({ till, term }) => {
  return new ExternalTokenizer((input, stack) => {
    let offset = 0;
    let eatNext = false;
    while (true) {
      const c = input.peek(offset);
      if (c === -1) break;
      if (c === CHAR_BACKSLASH) {
        eatNext = true;
      } else if (eatNext) {
        eatNext = false;
      } else if (isStringInterpolation(input, offset) || till(input, offset)) {
        if (offset > 0) {
          input.acceptToken(term, offset);
        }
        return;
      }
      offset = offset + 1;
    }
  });
};

const isTripleQuote = (input, offset) => {
  return (
    input.peek(offset) === CHAR_DQUOTE &&
    input.peek(offset + 1) === CHAR_DQUOTE &&
    input.peek(offset + 2) === CHAR_DQUOTE
  );
};

const isQuote = (input, offset) => {
  return input.peek(offset) === CHAR_DQUOTE;
};

const isBackquote = (input, offset) => {
  return input.peek(offset) === CHAR_BACKQUOTE;
};

export const tripleStringContent = makeStringContent({
  term: terms.tripleStringContent,
  till: isTripleQuote
});
export const stringContent = makeStringContent({
  term: terms.stringContent,
  till: isQuote
});
export const commandStringContent = makeStringContent({
  term: terms.commandStringContent,
  till: isBackquote
});

// LAYOUT TOKENIZERS

const isWhitespace = (input, offset) => {
  const c = input.peek(offset);
  return (
    (c >= 9 && c < 14) ||
    (c >= 32 && c < 33) ||
    (c >= 133 && c < 134) ||
    (c >= 160 && c < 161) ||
    (c >= 5760 && c < 5761) ||
    (c >= 8192 && c < 8203) ||
    (c >= 8232 && c < 8234) ||
    (c >= 8239 && c < 8240) ||
    (c >= 8287 && c < 8288) ||
    (c >= 12288 && c < 12289)
  );
};

export const layoutExtra = new ExternalTokenizer(
  (input, stack) => {
    // immediateParen
    if (
      input.peek(0) === CHAR_LPAREN &&
      !isWhitespace(input, -1) &&
      stack.canShift(terms.immediateParen)
    ) {
      input.acceptToken(terms.immediateParen, 0);
      return;
    }
    // immediateBracket
    if (
      input.peek(0) === CHAR_LBRACKET &&
      !isWhitespace(input, -1) &&
      stack.canShift(terms.immediateBracket)
    ) {
      input.acceptToken(terms.immediateBracket, 0);
      return;
    }
    // immediateDoubleQuote
    if (
      input.peek(0) === CHAR_DQUOTE &&
      !isWhitespace(input, -1) &&
      stack.canShift(terms.immediateDoubleQuote)
    ) {
      input.acceptToken(terms.immediateDoubleQuote, 0);
      return;
    }
    // immediateBackquote
    if (
      input.peek(0) === CHAR_BACKQUOTE &&
      !isWhitespace(input, -1) &&
      stack.canShift(terms.immediateBackquote)
    ) {
      input.acceptToken(terms.immediateBackquote, 0);
      return;
    }
    // immediateDot
    if (
      input.peek(0) === CHAR_DOT &&
      !isWhitespace(input, -1) &&
      stack.canShift(terms.immediateDot)
    ) {
      input.acceptToken(terms.immediateDot, 0);
      return;
    }
  },
  {
    // This is needed so we enable GLR at positions those tokens might appear.
    extend: true
  }
);
