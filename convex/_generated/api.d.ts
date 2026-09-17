/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as demo from "../demo.js";
import type * as jeu from "../jeu.js";
import type * as joueurs from "../joueurs.js";
import type * as lib_regles from "../lib/regles.js";
import type * as lib_reponses from "../lib/reponses.js";
import type * as partie from "../partie.js";
import type * as questions from "../questions.js";
import type * as reglages from "../reglages.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  demo: typeof demo;
  jeu: typeof jeu;
  joueurs: typeof joueurs;
  "lib/regles": typeof lib_regles;
  "lib/reponses": typeof lib_reponses;
  partie: typeof partie;
  questions: typeof questions;
  reglages: typeof reglages;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
