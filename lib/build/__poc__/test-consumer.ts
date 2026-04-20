/**
 * Test consumer — PoC ADR-0032 §11
 *
 * Ce fichier est compilé avec tsc --noEmit pour valider que le
 * bonsai.d.ts bundlé est consommable par un projet TypeScript.
 *
 * Critères validés :
 * - VC1 : compilabilité (tsc --noEmit → zéro erreur)
 * - VC5 : types Event présents (Channel, Radio, TAnyEventPayload)
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

// --- VC5 : types Event — Channel tri-lane + Radio singleton ---
import type { TAnyEventPayload } from "@bonsai/core";
import { Channel, Radio } from "@bonsai/core";

// Channel — tri-lane (Command 1:1, Event 1:N, Request sync T|null)
declare const channel: Channel;
channel.handle("addItem", (payload) => {}); // Command lane
channel.trigger("addItem", { productId: "abc" }); // Command lane
channel.listen("itemAdded", (payload) => {}); // Event lane
channel.emit("itemAdded", { productId: "abc" }); // Event lane
channel.reply("getItems", () => [1, 2, 3]); // Request lane
const items = channel.request("getItems", undefined); // Request lane — T | null

// Radio — singleton registre des Channels
const radio = Radio.me();
const ch: Channel = radio.channel("app");

// TAnyEventPayload — événement technique `any`
const anyPayload: TAnyEventPayload = { event: "itemAdded", changes: {} };

// --- VC4 : Namespace Valibot (Tier 1 — ADR-0022 + ADR-0032 §3) ---
import { Valibot } from "@bonsai/core";

// Le développeur utilise Valibot.* — pas de pollution du top-level
const userSchema = Valibot.object({
  name: Valibot.string(),
  age: Valibot.pipe(Valibot.number(), Valibot.integer(), Valibot.minValue(0))
});
type User = Valibot.InferOutput<typeof userSchema>;

// --- VC4b : Namespace Immer (Tier 3 — ADR-0001 + ADR-0032 §3) ---
import { Immer } from "@bonsai/core";

// Le framework utilise Immer.produce en interne — namespace opaque
type TestDraft = Immer.Draft<{ count: number }>;
const produced = Immer.produce({ count: 0 }, (draft: TestDraft) => {
  draft.count++;
});
