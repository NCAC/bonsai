/**
 * Test consumer — PoC ADR-0032 §11
 *
 * Ce fichier est compilé avec tsc --noEmit pour valider que le
 * bonsai.d.ts bundlé est consommable par un projet TypeScript.
 *
 * Critères validés :
 * - VC1 : compilabilité (tsc --noEmit → zéro erreur)
 * - VC5 : types Event présents (Channel, Radio, EventCallback)
 * - VC6 : types utilitaires présents (TJsonObject, TDictionary, etc.)
 */

// --- VC6 : types utilitaires ---
import type {
  TJsonObject,
  TDictionary,
  AnyFunction,
  TConstructor
} from "@bonsai/core";

const jsonObj: TJsonObject = { key: "value", nested: { count: 42 } };
const dict: TDictionary<number> = { alpha: 1, beta: 2 };
type TestFn = AnyFunction;
type TestCtor = TConstructor<object>;

// --- VC5 : types Event (Channel, Radio, EventCallback, RequestHandler) ---
import type { Channel, EventCallback, RequestHandler } from "@bonsai/core";

import { Radio } from "@bonsai/core";

// Channel — pub/sub + request/reply
declare const channel: Channel;
channel.on("user:login", (data: { userId: string }) => {});
channel.trigger("user:login", { userId: "abc" });

// Radio — singleton, accès aux channels
const radio = Radio.me();
const ch: Channel = radio.channel("app");

// EventCallback / RequestHandler
const eventCb: EventCallback<{ msg: string }> = (data) => {};
const reqHandler: RequestHandler<string, number> = (req) => req.length;

// --- VC4 : Namespace Valibot (Tier 1 — ADR-0022 + ADR-0032 §3) ---
import { Valibot } from "@bonsai/core";

// Le développeur utilise Valibot.* — pas de pollution du top-level
const userSchema = Valibot.object({
  name: Valibot.string(),
  age: Valibot.pipe(Valibot.number(), Valibot.integer(), Valibot.minValue(0))
});
type User = Valibot.InferOutput<typeof userSchema>;
