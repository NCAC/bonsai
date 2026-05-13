/**
 * @bonsai/feature - Version 0.1.0
 * Bundled by Bonsai Build System
 * Date: 2026-05-13T20:26:15.733Z
 */
import { Radio } from '@bonsai/event';

/******************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */
/* global Reflect, Promise, SuppressedError, Symbol, Iterator */


function __classPrivateFieldGet(receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
}

function __classPrivateFieldSet(receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
}

typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
    var e = new Error(message);
    return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
};

/**
 * @bonsai/feature — Types & runtime helpers
 *
 * Implémente :
 *   - ADR-0039 : autorité, unicité et conformité des namespaces de Feature.
 *   - ADR-0042 : pattern modulaire de contrat consommateur — `TFeatureContract`
 *     Feature-groupé + helpers d'aplatissement (`TFlatListens`, `TFlatTriggers`,
 *     `TFlatRequests`) + extracteurs de payload (`TEventPayloadFor`,
 *     `TCommandPayloadFor`, `TRequestParamsFor`, `TRequestResultFor`) +
 *     `TChannelCallbacks` (handlers requis dérivés du contrat).
 *
 * Trois rôles assumés par ce module :
 *   1. Types compile-time (`CamelCaseNamespace<S>`, `StrictManifest<M>`,
 *      `ValidatedManifest<M>`) qui encodent les invariants I68–I72.
 *   2. Constante framework `RESERVED_NAMESPACES` (I71) — non configurable
 *      par l'application.
 *   3. Filet de sécurité runtime (`assertValidNamespace`,
 *      `BonsaiNamespaceError`) pour les cas où le compile-time est contourné
 *      (cast `as any`, code JS, manifest dynamique).
 *
 * Invariants couverts :
 *   I21 (amendé) — namespace unique camelCase plat
 *   I24 (amendé) — Application valide format + réservés au bootstrap
 *   I57          — `local` réservé (ADR-0015)
 *   I68          — namespace porté par le manifest, pas par un `static`
 *   I69          — manifest = unique source de vérité de l'identité
 *   I70          — toute référence à un namespace externe DOIT être validée
 *   I71          — `RESERVED_NAMESPACES` est une constante framework
 *   I72          — `TSelfNS` doit correspondre à la clé du manifest
 *   I81 (ADR-0042) — `get features()` est la source de vérité runtime
 *   I82 (ADR-0042) — `implements TViewCallbacks<TVC>` impose les handlers
 *   I83 (ADR-0042) — pattern modulaire `T{Component}Contract` réutilisable
 *   I87 (ADR-0042) — clé d'objet ≡ namespace de la Feature référencée
 *   I88 (ADR-0042) — symétrie Contract/Callbacks
 *
 * @packageDocumentation
 */
// ─── Mots réservés (I71, ADR-0015) ──────────────────────────────────────────
/**
 * Namespaces réservés par le framework — interdits à toute Feature applicative.
 *
 * Constante framework non configurable. Toute extension future
 * (`router`, `extensions`, …) se fera par modification de cette constante,
 * propagée par le typage dérivé.
 */
const RESERVED_NAMESPACES = ["local"];
/**
 * Erreur typée pour toute violation détectée au runtime.
 *
 * Étend la hiérarchie d'erreurs framework évoquée par ADR-0003
 * (`BonsaiRegistryError`). Les codes sont stables et destinés à être
 * matchables par les consommateurs.
 */
class BonsaiNamespaceError extends Error {
    constructor(code, message) {
        super(`[Bonsai] ${code}: ${message}`);
        this.name = "BonsaiNamespaceError";
        this.code = code;
    }
}
// ─── Filet runtime ──────────────────────────────────────────────────────────
const CAMEL_CASE_REGEX = /^[a-z][a-zA-Z]*$/;
// ─── Filet runtime ──────────────────────────────────────────────────────────
/** Test runtime du format camelCase. */
function isCamelCaseNamespace(ns) {
    return CAMEL_CASE_REGEX.test(ns);
}
/** Test runtime de réservation. */
function isReservedNamespace(ns) {
    return RESERVED_NAMESPACES.includes(ns);
}
/**
 * Filet de sécurité — vérifie format + réservation au runtime.
 *
 * Appelé par le constructeur de `Feature` (immuabilité dès construction) et
 * par `Application.start()` (validation du manifest entier). Lève
 * `BonsaiNamespaceError` avec un code stable.
 */
function assertValidNamespace(ns) {
    if (typeof ns !== "string" || ns.length === 0) {
        throw new BonsaiNamespaceError("NAMESPACE_INVALID_FORMAT", `Namespace must be a non-empty string, received: ${String(ns)}`);
    }
    if (!isCamelCaseNamespace(ns)) {
        throw new BonsaiNamespaceError("NAMESPACE_INVALID_FORMAT", `Namespace "${ns}" must be camelCase (lowercase first letter, letters only)`);
    }
    if (isReservedNamespace(ns)) {
        throw new BonsaiNamespaceError("NAMESPACE_RESERVED", `Namespace "${ns}" is reserved by the framework`);
    }
}

/**
 * @bonsai/feature — Feature base class
 *
 * Strate 0 — Les 5 capacités :
 *   C1 — emit(event, payload) sur son propre Channel (typé TChannelDef, ADR-0040)
 *   C2 — handle(command) via auto-discovery des méthodes on{Name}Command
 *   C3 — listen(event) sur Channels externes déclarés via on{Channel}{EventName}Event
 *   C4 — reply(request) via auto-discovery des méthodes on{Name}Request
 *   C5 — request(token, name, params) vers Channels déclarés (typé via token, ADR-0040)
 *
 * Invariants :
 *   I1  — Feature ne peut emit() que sur son propre Channel
 *   I2  — Feature peut listen les Events des Channels externes déclarés
 *   I3  — Feature ne peut reply que sur son propre Channel
 *   I5  — Entity n'est accessible que par sa Feature propriétaire
 *   I12 — Aucune Feature ne peut emit sur le Channel d'une autre
 *   I21 — Chaque Feature DOIT être enregistrée dans le manifest applicatif
 *         sous une clé namespace unique camelCase plat (amendé ADR-0039)
 *   I22 — Relation namespace ↔ Feature ↔ Entity est 1:1:1 stricte
 *   I48 — Handlers auto-découverts par convention de nommage
 *   I68 — Le namespace est porté par le manifest applicatif, pas par
 *         un `static` sur la classe Feature (ADR-0039)
 *   I72 — `TSelfNS` doit correspondre exactement à la clé sous laquelle
 *         la Feature est enregistrée dans le manifest (ADR-0039)
 *   I73 — Chaque Feature concrète DOIT exposer `static readonly channel:
 *         TChannelToken<TChannelDef, TSelfNS>` — pont entre la classe et son
 *         Channel typé (ADR-0040)
 *   I74 — `TChannelDef` co-localisé dans le fichier `.feature.ts` du domaine
 *         (pas de `.channel.ts` séparé) (ADR-0040)
 *   I75 — Aucun `any`/`unknown` dans la surface publique de Channel/Feature/
 *         View ; casts internes documentés et délimités (ADR-0040)
 *   I76 — `Channel.{trigger,emit,request,handle,listen,reply}` strictement
 *         typés par `TDef` — clé = `keyof TDef[lane]`, jamais `string` libre
 *         (ADR-0040)
 *   I79 — `Feature.request()` accepte uniquement un `TChannelToken` typé ;
 *         `static readonly listens`/`channels` portent ces tokens pour
 *         déclaration au bootstrap (ADR-0040)
 *
 * @packageDocumentation
 */
var _Feature_instances, _Feature_namespace, _Feature_entity, _Feature_channel, _Feature_bootstrapped, _Feature_registerCommandHandlers, _Feature_registerRequestRepliers, _Feature_registerEventListeners;
// ─── Feature abstract class ──────────────────────────────────────────────────
/**
 * Feature — unité métier paramétrée par sa classe Entity, son contrat Channel
 * et son namespace.
 *
 * Paramètres de type :
 *   - `TEntity`     : la classe Entity (ADR-0037 — encode I22 au type-level)
 *   - `TChannelDef` : le contrat du Channel propre — types de commandes, events,
 *                     requests (ADR-0040 — I74, I76). Par défaut `TChannelDefinition`
 *                     (toutes lanes `Record<string, unknown>`) pour une utilisation
 *                     non paramétrée rétrocompatible.
 *   - `TSelfNS`     : le namespace sous lequel cette Feature s'attend à être
 *                     enregistrée dans le manifest applicatif (ADR-0039 — I72).
 *                     Par défaut `string` pour les sous-classes non paramétrées.
 *
 * **Le namespace n'est plus déclaré sur la classe** (`static namespace`
 * supprimé, ADR-0039 — I68). Il est :
 *   - injecté par le constructeur (immuabilité dès construction)
 *   - dérivé de la clé du manifest applicatif (source de vérité — I69)
 *   - validé au compile-time par `StrictManifest<M>` au `satisfies`
 *   - validé au runtime par `assertValidNamespace()` (filet — I71)
 */
class Feature {
    // ─── Constructor ───────────────────────────────────────────────────────
    /**
     * Crée une Feature attachée au namespace passé en paramètre.
     *
     * Appelé exclusivement par `Application.start()` qui transmet la clé du
     * manifest. L'instanciation manuelle (tests) doit aussi passer le namespace.
     *
     * @throws `BonsaiNamespaceError` si le namespace est invalide ou réservé.
     */
    constructor(namespace) {
        _Feature_instances.add(this);
        _Feature_namespace.set(this, void 0);
        _Feature_entity.set(this, void 0);
        // Canal propre — assigné au bootstrap, cast sûr par I22 (1 namespace = 1 TDef).
        _Feature_channel.set(this, void 0);
        _Feature_bootstrapped.set(this, false);
        assertValidNamespace(namespace);
        __classPrivateFieldSet(this, _Feature_namespace, namespace, "f");
    }
    // ─── Public API ────────────────────────────────────────────────────────
    /**
     * Le namespace de cette instance — immuable, défini au constructeur.
     * Typé `TSelfNS` (string littéral si la Feature est paramétrée).
     */
    get namespace() {
        return __classPrivateFieldGet(this, _Feature_namespace, "f");
    }
    /**
     * Accès à l'Entity (I5 — propriétaire exclusif).
     * Typée par la classe concrète (TEntity) grâce à ADR-0037.
     */
    get entity() {
        return __classPrivateFieldGet(this, _Feature_entity, "f");
    }
    /**
     * Bootstrap : crée l'Entity, enregistre les handlers sur le Channel,
     * et appelle onInit(). Appelé par Application ou manuellement en test.
     */
    bootstrap() {
        if (__classPrivateFieldGet(this, _Feature_bootstrapped, "f"))
            return;
        __classPrivateFieldSet(this, _Feature_bootstrapped, true, "f");
        // Cast sûr par I22 : 1 namespace = 1 Feature = 1 TDef (I75).
        __classPrivateFieldSet(this, _Feature_channel, Radio.me().channel(__classPrivateFieldGet(this, _Feature_namespace, "f")), "f");
        // I22 — Création de l'Entity 1:1 via le getter Entity (D17 amendé par ADR-0037)
        const EntityCtor = this.Entity;
        __classPrivateFieldSet(this, _Feature_entity, new EntityCtor(), "f");
        // Auto-discovery des handlers (I48)
        __classPrivateFieldGet(this, _Feature_instances, "m", _Feature_registerCommandHandlers).call(this);
        __classPrivateFieldGet(this, _Feature_instances, "m", _Feature_registerRequestRepliers).call(this);
        __classPrivateFieldGet(this, _Feature_instances, "m", _Feature_registerEventListeners).call(this);
        // Lifecycle
        this.onInit();
    }
    // ─── Capacités (C1–C5) ─────────────────────────────────────────────────
    /**
     * C1 — Émet un Event typé sur le propre Channel de cette Feature (I1, I12, ADR-0040).
     */
    emit(eventName, payload) {
        __classPrivateFieldGet(this, _Feature_channel, "f").emit(eventName, payload);
    }
    /**
     * C5 — Effectue une Request typée vers un Channel déclaré (I17, ADR-0040).
     * Retourne le résultat typé ou null (ADR-0023).
     */
    request(token, requestName, params) {
        return Radio.me().channelFor(token).request(requestName, params);
    }
    // ─── Lifecycle hooks ───────────────────────────────────────────────────
    /**
     * Hook appelé après le bootstrap. Override dans les sous-classes.
     */
    onInit() {
        // Default no-op — subclasses override
    }
}
_Feature_namespace = new WeakMap(), _Feature_entity = new WeakMap(), _Feature_channel = new WeakMap(), _Feature_bootstrapped = new WeakMap(), _Feature_instances = new WeakSet(), _Feature_registerCommandHandlers = function _Feature_registerCommandHandlers() {
    // Cast vers Channel non paramétré pour l'enregistrement par string (I75).
    const ch = __classPrivateFieldGet(this, _Feature_channel, "f");
    const proto = Object.getPrototypeOf(this);
    const methods = Object.getOwnPropertyNames(proto);
    for (const method of methods) {
        const match = method.match(/^on([A-Z][a-zA-Z]*)Command$/);
        if (match) {
            const commandName = match[1][0].toLowerCase() + match[1].slice(1);
            ch.handle(commandName, (payload) => {
                this[method](payload);
            });
        }
    }
}, _Feature_registerRequestRepliers = function _Feature_registerRequestRepliers() {
    // Cast vers Channel non paramétré pour l'enregistrement par string (I75).
    const ch = __classPrivateFieldGet(this, _Feature_channel, "f");
    const proto = Object.getPrototypeOf(this);
    const methods = Object.getOwnPropertyNames(proto);
    for (const method of methods) {
        const match = method.match(/^on([A-Z][a-zA-Z]*)Request$/);
        if (match) {
            const requestName = match[1][0].toLowerCase() + match[1].slice(1);
            ch.reply(requestName, (params) => {
                return this[method](params);
            });
        }
    }
}, _Feature_registerEventListeners = function _Feature_registerEventListeners() {
    const listenTokens = this.constructor.listens;
    if (listenTokens.length === 0)
        return;
    const proto = Object.getPrototypeOf(this);
    const methods = Object.getOwnPropertyNames(proto);
    for (const token of listenTokens) {
        const channelName = token.namespace;
        const channelPascal = channelName[0].toUpperCase() + channelName.slice(1);
        const prefix = `on${channelPascal}`;
        const suffix = "Event";
        // Cast vers Channel non paramétré pour l'enregistrement par string (I75).
        const ch = Radio.me().channel(channelName);
        for (const method of methods) {
            if (method.startsWith(prefix) && method.endsWith(suffix)) {
                const eventPascal = method.slice(prefix.length, -suffix.length);
                if (eventPascal.length === 0)
                    continue;
                const eventName = eventPascal[0].toLowerCase() + eventPascal.slice(1);
                ch.listen(eventName, (payload) => {
                    this[method](payload);
                });
            }
        }
    }
};
/**
 * Tokens des Channels externes écoutés par cette Feature (C3 — I2, ADR-0040).
 *
 * **Pourquoi `static` — deux raisons distinctes selon la propriété :**
 *
 * • `channel` (token propre, ADR-0040 — I73) — porteur de TYPE consommé sans
 *   instance. Une View ou Feature externe importe la classe uniquement pour
 *   son token (`CartFeature.channel`) afin de typer ses appels `trigger()` ou
 *   `request()`. Un token d'instance obligerait les consommateurs à tenir une
 *   référence à la Feature, violant la topologie du flux (I1, I4, I12).
 *   Ce token n'est pas déclaré sur la classe abstraite — chaque Feature concrète
 *   le déclare dans son fichier `.feature.ts` (I73, I74).
 *
 * • `listens` / `queries` — invariants de classe, identiques pour toute instance
 *   (I22 : une seule par namespace). Lus par `Application.start()` AVANT
 *   instanciation pour valider les dépendances croisées et câbler les
 *   listeners/repliers au bootstrap.
 *
 * **Limitation TypeScript** — `abstract static` n'existe pas.
 * La présence de ces propriétés ne peut pas être imposée compile-time aux
 * sous-classes. Filets de sécurité : `TFeatureClass` (type constructeur),
 * validation runtime dans `Application.start()`, tests de type (`tests/types/`).
 */
Feature.listens = [];
/**
 * Tokens des Channels externes interrogés par cette Feature (C5 — I17, ADR-0040 — supporte I79).
 *
 * **Pourquoi `static` :** identique à `listens` — invariant de classe lu
 * avant instanciation pour validation des dépendances croisées.
 *
 * **Limitation TypeScript** — `abstract static` n'existe pas.
 * Voir commentaire de `listens` ci-dessus.
 */
Feature.queries = [];

export { BonsaiNamespaceError, Feature, RESERVED_NAMESPACES, assertValidNamespace, isCamelCaseNamespace, isReservedNamespace };
