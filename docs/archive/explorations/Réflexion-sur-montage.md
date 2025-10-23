- Copilot said:

Voici mon avis clair et argumenté sur la notion de Projection DOM Réactive (PDR) telle qu’elle apparaît officiellement dans RFC‑0002 §9.4 Contrat de rendu  — et sur ton choix de l’intégrer dans Bonsai :

✅ Mon avis : c’est EXCELLENT. C’est même un choix différenciant, cohérent et techniquement solide.
Après lecture complète des RFC (0001 → 0002), je peux te dire que :
✔ La PDR est parfaitement alignée avec l’ADN architectural de Bonsai
Elle respecte plusieurs invariants clés :

I18 : la View a le monopole du rendu, et reste une projection pure
I30 : aucune View/Behavior ne possède de state → la projection directe est naturelle
I31 : le rootElement doit déjà exister dans le DOM → parfait pour un modèle basé sur la projection plutôt que la génération d’arbre
D19 : décision actée d’adopter la PDR comme stratégie officielle de rendu

La PDR n’est donc pas un patch, mais un choix organique, entièrement cohérent avec l'architecture.

✅ Techniquement, la PDR a un énorme avantage sur le Virtual DOM : elle exploite un signal que Bonsai possède déjà : le diff du state (Entity).
D’après RFC‑0002 Entity §6 (notifications per-key, diff 1er niveau) :
le framework sait exactement quoi a changé dans le state — sans avoir besoin de refaire un arbre virtuel, ni de faire un diff structurel.
Donc :

Pas besoin de comparer deux arbres DOM
Pas besoin de moteur de reconciliation comme React
Pas de patching complexe
Pas de coûts de diff

Tu utilises un signal déjà existant, fourni par l’Entity.
C’est économique, élégant et conceptuellement solide.

✅ La PDR répond à un vrai problème des frameworks SPA modernes :
1. La majorité des applications ont un DOM existant (SSR, CMS, Drupal…)
RFC‑0002 §9.4 l’énonce explicitement : dans 99% des cas, le DOM existe déjà (SSR, CMS).
Donc :

pourquoi régénérer un arbre depuis zéro ?
pourquoi faire un diff d’un VDOM qui n’a pas lieu d’être ?
pourquoi rendre la même structure deux fois (backend + frontend) ?

La PDR supprime ces redondances artificielles.

2. Elle évite le double‑template (back + front)
C’est un point absolument décisif si Bonsai vise les environnements CMS.
Le Mode C (templates partiels / îlots) permet :

SSR complet côté serveur
seulement quelques zones réactives côté client
des templates PugX qui ne redoublent pas le markup serveur
un DOM maître = HTML serveur
des patches locaux uniquement

C’est exactement ce qu’Angular, React, Vue et Svelte ne font pas, parce qu’ils veulent contrôler tout le DOM.
Bonsai devient donc idéal pour ton contexte Drupal.

3. Elle permet un rendu O(Δ) réel
Pas d’allocation, pas de diff d’arbre, pas de rebuild complet.
Juste :

un événement métier
un diff Entity (per-key)
une projection ciblée sur un ou plusieurs nœuds

Tout le pipeline est linéaire et minimal.

4. Elle unifie View et Behavior sous la même mécanique
RFC‑0002 Q7 (résolu) confirme que les Behaviors peuvent aussi utiliser les primitives PDR pour altérer l’UI de manière encadrée.
Donc :

un seul système de rendu
un seul système de sélection (getUI)
un seul système de patch DOM
pas de divergence conceptuelle entre View et Behavior

Belle cohérence conceptuelle.

🧠 D’un point de vue design et architecture logicielle, la PDR est une approche de “rendu minimal enveloppé par un système réactif”, extrêmement propre.
Elle a trois propriétés rarissimes dans les frameworks modernes :
🔹 1. Pureté : View = projection pure (state → DOM), sans layers intermédiaires
La projection n’est pas un arbre virtuel, pas une abstraction :
c’est un ensemble de mutations DOM minimales.
🔹 2. Localité : les templates PugX possèdent leur propre sous-arbre (île)
Pas de global VDOM → pas d’effet cascade.
🔹 3. Prédictibilité : aucune magie, aucune heuristique, aucune surprise
Le moteur n’a pas besoin d’inférer “ce qui a bougé” :
il le sait via les Entities.

💡 Et d’un point de vue positionnement : Bonsai devient un framework parfaitement adapté aux architectures hybrides SPA/SSR.
Là où :

React → impose un rendu virtuel
Vue → impose ses templates + VDOM
Svelte → compile vers un mini-runtume mais contrôle le DOM
Angular → veut tout posséder via ses composants

Bonsai dit :

« Le DOM existe déjà. Je ne le recrée pas.
Je ne remplace pas le serveur.
Je projette, je ne rends pas. »

C’est un positionnement unique, moderne, pragmatique.

👉 Ce que je renforcerais (mini recommandations)
1. Mettre un schéma synthétique PDR dans la doc
Il existe déjà un schéma runtime, mais un diagramme dédié PDR serait utile :
State (Entity) 
   ↓ (diff per-key)
Feature handler 
   ↓ (event)
View handler
   ↓
Template.project(nodes, data)
   ↓
Mutation DOM chirurgicale

2. Préciser que la PDR est isomorphe à un “diff implicite”
Ainsi, plus besoin de VDOM :
l’Entity sert déjà de “source truth structurelle”.
3. Documenter clairement les cas non adaptés
(par ex. rendering massif type canvas, animations complexes, transitions globales…)

🧩 Conclusion
👉 C’est le bon choix.
👉 C’est aligné avec l’architecture.
👉 C’est performant.
👉 C’est différenciant sur le marché.
👉 C’est particulièrement adapté à Drupal/SSR.
Et surtout :
💚 La Projection DOM Réactive est un concept propre, formellement justifiable, et parfaitement adapté à Bonsai.
Si tu veux, je peux aussi te proposer :

une définition officielle en une phrase,
un résumé pour page d’accueil,
un diagramme PDR (ASCII ou image),
une section complète pour la doc.

Dis-moi ce que tu préfères !

---
- Les autres frameworks n’ont pas cette connaissance du state ?

---

- Copilot said: 

Si, les autres frameworks “connaissent” le state… mais pas de la même manière, ni au bon niveau, ni avec la bonne granularité pour éviter un diff de rendu.

Je détaille précisément, parce que c’est là que se joue la vraie différence avec ta Projection DOM Réactive (PDR).

1️⃣ Tous les frameworks ont un state… mais pas un state structurant le rendu
✅ React / Vue / Angular / Svelte savent :

qu’un state a changé
quelle variable a changé
parfois quelle dépendance est concernée

❌ Mais ils ne savent pas :

quelles parties exactes du DOM réel doivent être mutées
quels nœuds existent déjà côté serveur
si une mutation DOM est déjà correcte ou redondante

👉 Résultat : ils recalculent une projection complète (ou partielle) du DOM, puis comparent.

2️⃣ Le point clé : où se situe la connaissance du state
Dans Bonsai (PDR)
Le state est :

centralisé
typé
encapsulé dans l’Entity
diffé automatiquement (per-key, intentionnel)

👉 Le framework sait avant le rendu :
Plain Text- CE QUI a changé- POURQUOI ça a changé (command / event)- DANS QUEL DOM ZONE ça doit se refléterAfficher plus de lignes
La View n’a pas besoin de recalculer un arbre.

Dans React / Vue
Le state est :

dispersé (hooks, reactive refs, component local state)
non sémantique (pas de notion métier)
non relié directement au DOM existant

Donc le framework sait seulement :
Plain Text“Quelque chose a changé → je dois recalculer la vue”Afficher plus de lignes
👉 Il re-génère une représentation, puis diff.

3️⃣ Cas par cas
🔵 React

Le state est connu (hooks, setState)
Les dépendances sont connues (via render + hooks)
Mais React ne sait jamais :

quel DOM existe déjà côté serveur
si le markup est déjà correct
quelle mutation DOM est strictement nécessaire



👉 Donc :

render() → nouvel arbre React
reconciliation → diff VDOM
commit → DOM

💡 Le state est connu, le DOM cible ne l’est pas.

🟢 Vue

Réactivité plus fine (dependency tracking)
Peut éviter certains recalculs
Mais :

la projection reste un template → VDOM
le DOM réel est une conséquence finale



👉 Vue optimise le recalcul, pas le besoin de recalculer.

🟠 Angular

Détection de changement très fine
Change detection très optimisée
Mais :

le template est toujours la source de vérité
le DOM est reconstruit mentalement à chaque cycle



👉 Le state est connu, mais le DOM est toujours “virtuel” dans l’esprit du framework.

🟣 Svelte
C’est le plus proche de ta philosophie, mais avec une différence cruciale :
✅ Il connaît les dépendances à la compilation
✅ Il génère du code DOM très ciblé
❌ Mais :

il recrée le DOM à partir du JS
il ne part pas d’un DOM serveur existant
il impose son HTML

👉 Svelte optimise le comment muter, pas le pourquoi muter.

4️⃣ Ce que les autres frameworks n’ont pas, et que Bonsai a
❌ Absence universelle ailleurs
Aucun grand framework n’a simultanément :

Un state centralisé et typé métier
Un diff explicite du state
Une correspondance directe state → zone DOM
Un DOM existant comme source de vérité structurelle


✅ Bonsai (PDR) a tout ça
Parce que :

l’Entity sait ce qui a changé
la Feature sait pourquoi
la View sait où projeter
le DOM existe déjà

👉 Donc pas besoin de VDOM.

5️⃣ Pourquoi les autres frameworks ne peuvent pas faire ça (structurellement)
Ce n’est pas un oubli. C’est structurel.
Ils ont fait le choix :

composant = unité de state + rendu
template = vérité structurelle
DOM = produit final

Bonsai fait le choix inverse :

Feature = unité de state
View = projection pure
DOM = vérité structurelle

👉 Ce renversement rend la PDR possible.

6️⃣ En une phrase (clé)

Les autres frameworks connaissent le state,
mais Bonsai connaît le sens du changement et sa cible DOM.

C’est exactement ce qui rend :

le Virtual DOM inutile
le diff d’arbre superflu
la PDR possible et cohérente


Si tu veux, au prochain message je peux :

te faire un tableau comparatif ultra synthétique
formuler une phrase officielle pour la doc
ou te challenger : dans quels cas la PDR ne suffit pas (il y en a).

Tu veux aller où maintenant ?
Fournissez vos commentaires sur BizChatYou said: Quels cas ne conviennent pas à la PDR ?Copilot said: CopilotTrès bonne question — parce que la PDR n’est pas une solution universelle, et c’est justement ce qui la rend saine architecturalement.
Je vais te répondre sans langue de bois, en classant les cas où la Projection DOM Réactive est un mauvais choix, pour des raisons structurelles, pas idéologiques.

✅ Rappel ultra‑court : quand la PDR est idéale
La PDR fonctionne parfaitement quand :

le DOM existe déjà (SSR, CMS, HTML statique),
le state est centralisé et typé (Entity),
les changements sont sémantiques (events métier),
le rendu peut être localisé (zones / îlots),
la View est une projection pure.

Dès qu’un de ces piliers tombe, la PDR devient moins adaptée.

❌ Cas n°1 — UI très générative / structurellement dynamique

Quand la structure du DOM elle‑même est le produit principal du state.

Exemples

éditeur de page type Notion, Figma, Miro
constructeur de formulaires dynamiques
visual editor où chaque interaction change la structure globale

Pourquoi la PDR est mauvaise ici

la structure DOM n’est pas stable
il n’y a pas de “DOM maître” pré‑existant
chaque action peut :

créer / supprimer / déplacer des sous‑arbres entiers


la projection devient structurelle, pas incrémentale

👉 Ici, un Virtual DOM ou un AST UI est plus adapté.

❌ Cas n°2 — Canvas / WebGL / SVG heavy

Quand le DOM n’est pas le support du rendu.

Exemples

jeux
dataviz lourde (charts animés, graphes dynamiques)
moteurs 2D/3D
timelines interactives

Pourquoi la PDR n’a aucun intérêt

le rendu n’est pas DOM‑based
les primitives sont :

draw(), paint(), renderFrame()


le DOM, s’il existe, n’est qu’un conteneur

👉 Ici :

state → frame, pas state → DOM
la PDR est hors sujet


❌ Cas n°3 — Animations complexes dépendantes du layout

Quand le layout est une donnée d’entrée du rendu.

Exemples

animations FLIP très complexes
transitions dépendantes de getBoundingClientRect()
UI “physique” (springs, inertia, collision)

Problème avec la PDR
La PDR suppose :

le layout est une conséquence, pas une variable métier

Or ici :

tu dois mesurer
puis recalculer
puis muter
puis mesurer encore

👉 Le rendu devient bidirectionnel DOM ↔ state, ce qui casse la pureté de la projection.

❌ Cas n°4 — UI locale ultra‑éphémère, non observable

Quand l’état n’a aucune valeur métier ni inter‑composants.

Exemples

hover très local
drag visuel temporaire
survol, focus, highlight purement décoratif
tooltip jetable

Pourquoi la PDR est trop lourde

créer une Entity
un Command
un Event
une projection

…pour un effet de 50 ms, c’est inutilement coûteux conceptuellement.
👉 Dans Bonsai, c’est exactement le rôle :

des Behaviors
ou du DOM direct encadré

Et tu l’as déjà prévu 👍

❌ Cas n°5 — Applications sans DOM existant

Quand le HTML est produit exclusivement côté client.

Exemples

SPA “from scratch”
micro‑frontend JS pur
apps embarquées sans SSR

Pourquoi la PDR perd son avantage

il faut quand même créer le DOM
donc écrire des templates complets
donc gérer la structure entière

👉 À ce stade :

la PDR devient une implémentation manuelle de VDOM
sans les optimisations d’un moteur dédié

Elle n’est pas fausse, juste moins rentable.

❌ Cas n°6 — Rendu massivement data‑driven sans sémantique métier

Quand le state est “brut”, pas intentionnel.

Exemples

dashboards temps réel ultra‑génériques
flux de données non interprétés
visualisation de structures arbitraires (JSON viewer, log viewer)

Problème
La PDR repose sur :

un diff métier porteur de sens

Si ton state est :

un blob
sans invariants
sans événements sémantiques

👉 alors la View ne sait pas quoi projeter intelligemment.

⚠️ Cas limites (gris)
Ce ne sont pas des “non”, mais des zones de vigilance :

Cas | Comment faire
Listes très longues | `ProjectionList` + clés solides
Animations simples | CSS + classes via PDR
Drag & drop | Behavior + PDR minimale
SSR partiel | Mode C (îlots)
SEO + interactivité | PDR = excellent

🧠 Le point fondamental (le plus important)

La PDR est un modèle de projection, pas de construction.

Dès que ton UI devient :

constructive
auto‑structurante
non ancrée dans un DOM existant

👉 elle sort naturellement du domaine de validité de la PDR.
Et c’est normal.

✅ Pourquoi ton design Bonsai est sain malgré tout
Parce que :

tu ne prétends pas couvrir tous les cas
tu assumes un périmètre clair
tu prévois des échappatoires contrôlées :

Behavior
DOM direct
templates complets (Mode B)
projection partielle (Mode C)



👉 C’est exactement ce qu’un framework mature doit faire.

🧩 En une phrase (à garder)

La Projection DOM Réactive est idéale quand le DOM est stable et le state est sémantique.
Elle n’est pas faite pour générer le monde, mais pour le maintenir juste.

Si tu veux, au prochain échange, je peux :

te proposer un encadré “Quand ne PAS utiliser la PDR” prêt pour la doc,
ou te challenger sur un cas concret de ton projet (Drupal / Bonsai).

----

- You said: En fait le RFC n’est pas achevé il manque la composition des Views (RootNode, ViewChildrenManager)

---


- Copilot said: Tu as 100% raison : sur la composition des Views, le RFC est encore trop “index/contrat” et il manque la partie mécanique / protocole (RootNode + ViewChildrenManager) avec assez de précision pour que quelqu’un puisse implémenter le runtime sans ambiguïtés. Le document liste bien les composants et l’intention (API + lifecycle), mais il ne donne pas encore le contrat opérationnel complet (séquence, ownership DOM, règles de remplacement, gestion des subscriptions, teardown, erreurs).
Ci-dessous, je te propose ce qu’il manque, sous forme de sections prêtes à coller dans le RFC‑0002 (ou à extraire en RFC dédiée), tout en restant cohérent avec les décisions déjà posées : View cycle de vie passif, PDR, rootElement existant, delegation events, etc.

1) Ce que le RFC dit déjà (mais trop haut niveau)
Le RFC mentionne bien :

RootNode : point d’ancrage, attach/detach d’une View racine, persistant, créé par Application.
ViewChildrenManager : add/remove/replace/clear/getChildren + une esquisse de cycle de vie des sous-Views, “interne framework”.
Cycle de vie View : onAttach/onDetach/onRender + “passif” (la View ne décide pas).
PDR : projection sur DOM existant, templates (A/B/C), getUI/getUIList, ProjectionNode/List, event delegation.

Mais il manque la couture : qui fait quoi, dans quel ordre, avec quelles garanties et quelles erreurs.

2) Ce qu’il manque vraiment : le “protocole de composition”
A. Le contrat d’ownership DOM (fondamental)
Il faut expliciter :

Qui possède la décision de créer/détruire/remplacer une View : RootNode / VCM (et jamais la View). (Le RFC l’affirme, mais pas assez opératoire.)
Qui possède quel DOM en Mode B (template root) vs Mode C (îlots) :

En Mode B, la View “possède” l’intérieur du root container (remplacement complet).
En Mode C, la View “possède” uniquement des sous-zones @ui (mutations limitées).


Interdiction d’écrire en dehors de son périmètre (View vs Behavior vs View enfant), sinon c’est une source de bugs.

👉 Sans ça, tu te retrouves avec des conflits silencieux entre :

projection d’un parent,
projection d’un enfant,
Behavior qui “touche” le même nœud,
et surtout remplacement de sous-arbres.

Le RFC évoque déjà que le Behavior altère le DOM “de manière encadrée” via PDR, mais il faut figer le contrat de non‑conflit (sélecteurs disjoints / zones réservées).

B. La séquence exacte attachView() / detachView() (RootNode)
Le RFC donne l’API RootNode, mais pas la séquence normative.
Il manque une section du style :
RootNode.attachView(ViewClass) doit garantir :

Si une View racine existe → exécuter detachView() d’abord.
Instancier la View (et Behaviors associés si c’est prévu par design).
Résoudre rootElement (dans le contexte RootNode) :

s’assurer que l’élément existe (sinon erreur; invariant rootElement existant déjà).


Préparer PDR :

construire uiCache à partir de uiElements,
brancher délégation d’événements à el.


Templates :

Mode A/B/C : appeler setup() et remplir nodes.


Brancher les subscriptions Channel (listen) pour la View/Behaviors.
Appeler view.onAttach().
Optionnel : projection initiale (soit par request() + project(), soit par un “initial event” interne).

Et côté detach :

Appeler view.onDetach() (hook).
Unsubscribe Channels + clean DOM listeners.
Libérer références (nodes, uiCache) pour éviter fuites.
Détruire récursivement les sous-Views via VCM.
Mettre à null la View racine.

Le RFC mentionne les hooks et le nettoyage, mais il n’impose pas encore la mécanique.

C. La composition : “où vivent les enfants ?”
Le ViewChildrenManager est mentionné, mais il manque :

la relation : un VCM est attaché à une View parente (ou un container @ui),
la cible DOM : dans quoi il insère les sous-Views (un conteneur DOM explicite),
la notion de slot ou mount point.

Aujourd’hui, ton RFC décrit getUIList() et la réconciliation des listes DOM, mais ne relie pas clairement ça à “composition de sous-views”.
Deux approches possibles (à expliciter) :

Composition DOM-simple : VCM insère des rootElement d’enfants dans un conteneur donné.
Composition par “mount @ui” : la View parent expose un @ui.childrenContainer réservé à VCM, et le VCM ne touche qu’à ce conteneur.

Dans les deux cas il faut dire :

qui crée le container si absent,
si le child View rootElement est relatif ou absolu,
comment garantir l’invariant “rootElement existe” quand l’enfant est dynamique.

👉 Et là il y a un point subtil : ton invariant rootElement-exists (I31) marche parfaitement pour une View “ancrée SSR”. Pour des subviews dynamiques, il faut une nuance :

soit le VCM crée un mount element (donc rootElement enfant devient “interne”),
soit le rootElement enfant doit exister dans le template parent (SSR), donc l’enfant ne peut pas être “spawned” arbitrairement.

Ce point doit être tranché explicitement.

3) Les décisions ouvertes que tu devrais figer pour rendre RootNode/VCM implémentables
Décision 1 — “RootElement” des subviews : absolu, relatif ou injecté ?
Tu as déjà : “rootElement doit exister dans le DOM au moment de onAttach”.
Mais pour une subview, 3 options :

A (absolu SSR) : rootElement = sélecteur global (#id) déjà présent.
✅ simple, ❌ très rigide
B (relatif au parent) : rootElement = sélecteur dans le parent el.
✅ bon compromis, impose un “scope”
C (injecté par le framework) : pas de rootElement côté subview ; VCM fournit el directement (mount).
✅ ultra flexible, mais implique une exception à l’invariant ou une redéfinition (“rootElement” pour root views seulement).

👉 Tant que ce point n’est pas écrit, la composition ne peut pas être spécifiée proprement.

Décision 2 — “Replace” : quelles garanties de transition ?
Le RFC mentionne replace(old, newClass) mais pas le contrat :

Est-ce que replace est atomique (l’utilisateur ne voit pas un DOM intermédiaire) ?
ordre : old.onDetach → remove DOM → create new DOM → new.onAttach ?
ou “double buffer” : create new → swap → destroy old ?
comment on gère les animations de transition ?

Sans ça, “replace” reste une API vide.

Décision 3 — Subscriptions Channels pendant la composition
Le RFC explique bien listen/trigger/request typés, mais ne dit pas quand les handlers View sont câblés lors de l’insertion de subviews (bootstrap étape 6+) vs runtime.
Il faut fixer :

à quel moment on subscribe,
qui unsub,
comment on évite les fuites (subviews destroyed).


4) Proposition concrète : un plan de section “Composition des Views” à ajouter
Tu peux ajouter une section RFC‑0002 du style :
§11 RootNode — protocole complet

11.1 API (déjà là)
11.2 Ownership DOM (root scope)
11.3 Séquence attach/detach (normative)
11.4 Gestion des subscriptions Channel View/Behavior
11.5 Erreurs (rootElement introuvable, template invalide, conflit de projection)

§12 ViewChildrenManager — protocole complet

12.1 API (déjà là)
12.2 Mount points (où insérer)
12.3 Gestion du cycle de vie child View
12.4 Replace semantics
12.5 Composition vs ProjectionList (différence et complémentarité)
12.6 Règles anti‑conflit (zones réservées, behaviors)


5) Question pour toi (la seule vraiment bloquante)
Pour compléter proprement le RFC, j’ai besoin d’une décision de design :
👉 Quand tu composes des subviews dynamiques, tu veux que leur rootElement…

existe déjà dans le HTML SSR (donc composition = activer/désactiver des zones pré‑marquées),
ou
soit créé par le framework (donc VCM fabrique un mount et “injecte” l’el à la subview) ?

Les deux sont cohérents avec Bonsai, mais ils ne mènent pas aux mêmes invariants.

Si tu me réponds sur ce point (1 ou 2, ou un hybride), je te rédige immédiatement :

la spécification complète RootNode/VCM en style RFC (normative “MUST/SHOULD”),


un mini schéma d’exécution,




les erreurs et garde‑fous (debug/strict), en cohérence avec le reste du doc.

-----

You said: Très simple: la View déclare en propriété un ViewChildrenManager et une Map d’éléments. Le viewChildrenManager écoute des événements de la View si un changement survient dans le DOM et instance/detruit la View « enfant »
---

Copilot said: OK, je vois très bien l’idée : la View possède un ViewChildrenManager + une Map de “mount points”, et le VCM crée/détruit des sous-Views quand “quelque chose change” dans le DOM. C’est simple sur le papier… mais il y a un piège : “écouter le DOM” comme source de vérité peut vite devenir une usine à boucles / indéterminisme si on ne verrouille pas un protocole strict.
Je te propose donc une version tout aussi simple, mais spécifiée (donc implémentable et debuggable), compatible avec ton modèle PDR + cycle de vie passif.

1) Ce qui est excellent dans ta proposition
✅ A. La View “déclare” ses slots et garde un registre (Map)
Ça colle parfaitement à l’esprit Bonsai : dépendances/structure déclaratives, pas de découverte dynamique opaque.
✅ B. Le VCM est “un composant interne” au runtime, attaché à une View
C’est exactement le pattern que tu as déjà commencé à poser (VCM gère composition, la View reste passive côté lifecycle).

2) Le point dangereux : “le VCM écoute le DOM”
Si tu fais : DOM change → VCM crée/détruit des Views, tu inverses la causalité :

Bonsai pose un flux où le rendu est une conséquence d’un événement/state (PDR).
Si le DOM devient le trigger de création/destruction, tu crées une boucle possible :

Event → projection (PDR) modifie le DOM
DOM modifié → VCM réagit → instancie des Views
nouvelles Views → projection → modifie encore le DOM
etc.



Même si tu utilises un MutationObserver, tu risques :

des instanciations multiples (double fire),
des glitches pendant replace,
des conditions de course quand un template “switch branch”,
des fuites si le DOM est modifié par autre chose (Behavior, scripts tiers).

Conclusion : oui à “observer”, mais le DOM ne doit jamais être la source de vérité décisionnelle. Il doit être au mieux un signal de validation / synchronisation, dans une fenêtre contrôlée.

3) La version “simple mais sûre” : le VCM écoute la View, pas le DOM
Tu as dit : “le VCM écoute des événements de la View” — c’est la bonne direction. La clé est :

Ce sont les changements de structure décidés par la View (ou par ses templates) qui déclenchent le VCM.

Ça respecte :

cycle de vie passif des Views (elles ne s’auto-créent pas, mais elles peuvent exposer des signaux),
PDR (le DOM est la cible, pas l’oracle),
et surtout le “pas de magie”.

🔥 Contrat minimal à poser
La View doit exposer :

1. Une Map de slots (mount points)
2. Une méthode/hook “structure changed” appelée uniquement quand la View a délibérément modifié la structure (ex: switch d’un template fragment, reconcile de liste, toggle d’une zone conditionnelle).

Exemple conceptuel :
```typeScript
type TChildSlot = {
   el: HTMLElement;         // mount point
   policy: 'single' | 'list';
};
class SomeView extends View<...> {
   protected readonly children = new ViewChildrenManager(this);
   
   // Map: slotName -> mount info
   protected readonly slots = new Map<string, TChildSlot>([
      ['sidebar', { el: /*resolved @ui*/, policy: 'single' }],
      ['items', { el: /*resolved @ui*/, policy: 'list' }],  ]);
      
   // Hook interne: appelé par le framework après une projection qui change la structure
   protected onStructureChanged(changes: TStructureDelta): void {
      this.children.sync(changes);
   }
}
```

**Important** : `onStructureChanged` est déclenché par *la projection* (donc par la View / templates), pas par le DOM “tout seul”.


4) D’où vient “le changement de structure” sans écouter le DOM ?
Tu as déjà dans ton RFC des primitives qui te donnent naturellement ce signal :
✅ A. ProjectionList.reconcile(...) sait exactement ce qu’elle a fait
Ton ProjectionList est déjà le bon endroit pour produire un delta structurel : insertions / suppressions / moves.
Donc reconcile peut retourner un petit rapport (ou déclencher un callback) :

addedKeys
removedKeys
movedKeys
containerKey (slot)

✅ B. Les templates (Mode B/C) peuvent déclarer des zones “child mounts”
Ton système de templates setup/project/create est déjà pensé pour distinguer statique/dynamique et gérer des branches.
Donc le compilateur peut marquer explicitement des mount points (ex: commentaire <!-- bonsai:slot=sidebar --> ou data-bonsai-slot="sidebar").
👉 Dans ces deux cas, tu n’as pas besoin d’un MutationObserver global : tu as une source contrôlée.

5) Le contrat du VCM : “sync” déterministe (pas “réagir au hasard”)
Voici une spécification simple et robuste :
ViewChildrenManager.sync(delta)

Pour chaque slot :

si policy: 'single' :

attach(ViewClass) si le slot “demande” une view
detach() sinon


si policy: 'list' :

reconcileChildren(keys, factory) : créer/détruire/réordonner des child views





Et surtout :

Le VCM ne touche jamais en dehors de slot.el
Le VCM ne scanne pas le DOM global
Le VCM ne décide jamais sur un DOM “observé” sans delta

C’est parfaitement cohérent avec le fait que RootNode/VCM détiennent le cycle de vie, pas les Views.

6) Et si tu tiens vraiment à “écouter le DOM” ?
Tu peux, mais uniquement comme garde-fou debug :

activer un MutationObserver scopé aux conteneurs slot.el
pendant une fenêtre courte (juste après project() / reconcile())
pour vérifier que :

les mount points existent,
il n’y a pas eu de modification illégitime hors zone,
pas de conflit View vs Behavior



Donc DOM-observer = validation, pas orchestration.
Ça colle bien à ton approche “debug vs prod” (plus de validations en debug, off en prod).

7) Un détail crucial à trancher (mais compatible avec ta “simplicité”)
Les child Views ont-elles un rootElement qui doit exister (I31) ?
Dans ton RFC, rootElement doit exister au moment de onAttach.
Pour des subviews dynamiques, tu as deux options simples :

RootElement = le slot fourni par le parent (injecté)
→ la child view n’a pas besoin d’un sélecteur global, elle reçoit directement el.
RootElement = un élément SSR déjà présent dans slot.el
→ plus rigide, mais cohérent SSR.

Vu ta proposition “Map d’éléments mount”, l’option 1 est la plus naturelle : le parent fournit le container, et le child s’ancre dedans.

Conclusion (mon avis)
Ton idée est bonne si tu la formules ainsi :
✅ VCM écoute la View (ses signaux de projection / structure)
✅ La View expose des slots (Map de mount points)
✅ Le DOM n’est jamais la source de décision (au mieux un garde-fou debug)

Questions rapides (pour que je te rédige la spec finale, prête RFC)

Tu veux un modèle de child view où le child reçoit directement el (mount injecté), ou tu veux conserver rootElement même pour les enfants ?
Tes slots sont plutôt :

single (0/1 enfant),
list (N enfants keyés),
ou les deux ?



Donne-moi ces 2 réponses et je t’écris la section RFC complète “Composition des Views” (RootNode + VCM), avec MUST/SHOULD, séquences attach/detach, et règles anti-conflit View/Behavior.
Fournissez vos commentaires sur BizChatYou said: Oui ok le principe est surtout que View ne fait jamais de composition d’autres Views mais doit informer VCM si les slots apparaissent ou disparaissent. C’est vCM qui porte la responsabilité de créer ou détruire les Views « enfants » Copilot said: CopilotRaisonnement terminé dans 1 étapeParfait — et là tu touches exactement le contrat architectural qui rend la composition prévisible et testable :

La View ne compose jamais. Elle signale.
Le ViewChildrenManager compose. Il décide et exécute la création/destruction des sous-Views.

Je te propose de formaliser ça en une mini‑spécification (prête à intégrer dans RFC‑0002), avec un vocabulaire clair : Slots, Presence, Sync, Ownership.

1) Principe central (à écrire noir sur blanc)
✅ Règle A — séparation stricte

View : projection DOM (PDR), interactions, aucune responsabilité sur le lifecycle d’autres Views.
VCM : unique propriétaire du lifecycle des sous-Views (create/destroy/replace/reorder) pour un périmètre donné.


La View peut détecter/produire l’information “slot présent / slot absent”, mais ne crée jamais elle‑même une View enfant.


2) Contrat de “slot” (ce que la View doit fournir)
✅ Règle B — slots déclarés par la View
La View expose :

un ViewChildrenManager
une Map de slots (mount points) résolus dans le DOM

Ces slots sont des conteneurs DOM dans lesquels le VCM a le droit d’insérer une sous-View (et seulement là).
Exemple de types (concept)
TypeScripttype TSlotKey = string;type TSlot = {  /** conteneur DOM dans lequel le VCM peut gérer des enfants */  el: HTMLElement;  /** policy de composition */  policy: 'single' | 'list';  /** optionnel : clé d’identification pour liste */  keyAttr?: string; // ex: 'data-id'};Afficher plus de lignes

Cette approche est cohérente avec le modèle existant de View : rootElement + uiElements + zones de projection, et avec l’existence d’un VCM attaché à la View.


3) Comment la View “informe” le VCM (sans composer)
✅ Règle C — signaler la présence/absence de slots
La View ne doit pas “observer le DOM en continu” comme oracle, mais émettre un signal contrôlé quand sa projection (templates/reconcile) a potentiellement changé la structure et donc la présence des slots.
Deux variantes (compatibles) :
Variante C1 — signal explicite “structure changed”
Après une projection (ou un reconcile) susceptible d’ajouter/enlever un slot :
`this.children.notifySlotsChanged();`
Le VCM re-scanne uniquement les slots connus et synchronise.
Variante C2 — signal enrichi “delta”
Si tu veux optimiser, la View peut fournir un delta minimal :
`this.children.notifySlotsChanged({  appeared: ['sidebar', 'items'],  disappeared: ['details'],});`

Les deux restent alignées avec l’idée déjà posée dans RFC‑0002 : le framework câble des cycles de vie et des mécanismes internes, la View reste passive sur la décision lifecycle.


4) Ce que le VCM doit faire (responsabilité complète)
✅ Règle D — VCM = exécuteur du lifecycle enfant
Le VCM fournit une méthode déterministe (ex: sync()), appelée suite au signal :


Pour chaque slot policy: 'single' :

si slot présent et une child view attendue → attach
si slot absent et une child view existe → detach



Pour chaque slot policy: 'list' :

si slot présent → reconcile des children (create / move / destroy)
si slot absent → destroy toutes les children de ce slot




Cette notion d’API de composition (add/remove/replace/clear/getChildren) existe déjà au niveau “index” dans RFC‑0002 ; ce qu’on ajoute ici, c’est le protocole normatif et le déclenchement via slots.


5) Règles d’ownership DOM (anti‑conflit)
C’est ici qu’on évite les bugs de “parent touche le DOM du child” ou l’inverse.
✅ Règle E — périmètre d’écriture

Le VCM peut uniquement :

insérer/retirer des root containers des child views dans slot.el
et jamais toucher en dehors.



✅ Règle F — View parent ne projette jamais dans les sous-arbres enfants

La projection PDR de la View parent ne doit pas muter le DOM appartenant aux children.
Elle se limite à ses propres nœuds/îlots, et aux slots (conteneurs), pas à leur contenu.


C’est cohérent avec ton contrat PDR (projection chirurgicale et zones d’ownership) et avec la séparation View/VCM.


6) Cycle de vie enfant (séquence normative)
Pour que ce soit implémentable, je te conseille de figer l’ordre :
✅ Attach d’une child view (dans un slot)

VCM crée un conteneur mount (si nécessaire)
instancie la View enfant
résout ses UI/templates
branche ses listeners (channels + DOM delegation)
appelle child.onAttach()

✅ Detach d’une child view

appelle child.onDetach()
unsubscribe channels + remove DOM listeners
destroy récursivement ses propres children (si elle a un VCM)
retire le mount du DOM
libère références


Cette logique complète ce que RFC‑0002 mentionne déjà sur “cycle de vie passif” et sur le fait que RootNode/VCM gèrent la création/destruction, mais sans le protocole détaillé.


7) Où placer ça dans le RFC (proposition)
Dans RFC‑0002, je ferais :

§11 RootNode : attach/detach + garanties, mais aussi “RootNode est un VCM racine” (conceptuellement).
§12 ViewChildrenManager :

12.1 API (déjà listée)
12.2 Slots contract
12.3 Sync protocol
12.4 Ownership rules
12.5 Error handling (slot introuvable, double mount, etc.)




8) Deux mini décisions à prendre (rapides, mais importantes)
Pour verrouiller la spec sans ambiguïté :


Le VCM crée-t-il le mount DOM si le slot “apparaît” ?

option la plus robuste : oui, il peut créer un conteneur interne dans slot.el pour la child (surtout en policy list).



Les slots sont-ils repérés via uiElements (recommandé) ou par selectors libres ?

recommandé : slots = @ui (donc typé / résolu / caché derrière getUI) pour rester aligné avec ton modèle de View.




Si tu veux, je te le rédige “RFC style” (MUST/SHOULD) en 1 bloc prêt à coller
Je peux te produire une section complète :

“12.2 Slots”
“12.3 Synchronization protocol”
“12.4 Ownership & conflicts”
“12.5 Error modes (debug/strict/prod)”

👉 Dis-moi juste : tu veux que le VCM gère aussi le cas liste keyée (N enfants) dès maintenant, ou on commence uniquement par single (0/1 enfant) ?

---

You said: As-tu des suggestions de nommage alternatives pour VCM en plus concis ?

---

Copilot said: Oui — et c’est une très bonne question, parce que le nom va porter la philosophie exacte que tu viens de poser :

la View signale,
le composant orchestre le cycle de vie des Views enfants.

Je te propose une palette de noms, classés par intention sémantique, avec mon avis critique à chaque fois.

🟢 1) Noms ultra‑concis (1 mot, très bons candidats)
Children

✅ Très concis
✅ Lisible dans le code : this.children.sync()
✅ Déjà naturel dans le vocabulaire UI
❌ Un peu générique (mais ce n’est pas forcément un défaut)

👉 Excellent candidat, surtout si le type est explicite (class Children).

Slots

✅ Correspond exactement à ton modèle mental
✅ Très clair conceptuellement (présence / absence de slot)
✅ Moderne (React, Web Components, Shadow DOM)
❌ Peut sous‑entendre un système plus statique que dynamique

👉 Très bon si tu assumes pleinement le vocabulaire slot‑based.

Composer

✅ Porte explicitement la responsabilité de composition
✅ Actif, intentionnel
✅ Distingue clairement View (projection) / Composer (composition)
❌ Un peu plus abstrait

👉 Très bon si tu veux nommer le rôle, pas la structure.

🟡 2) Noms clairs mais un peu plus longs
ViewComposer

✅ Très explicite
✅ Ambiguïté zéro
❌ Moins élégant à l’usage (this.viewComposer.sync())

👉 Bon nom “RFC / doc”, moins sexy dans le code.

ChildrenManager

✅ Compréhensible immédiatement
✅ Proche de VCM mais plus lisible
❌ Toujours un peu verbeux

👉 Variante raisonnable si tu veux garder “Manager”.

SubViews

✅ Très clair fonctionnellement
✅ Parfait pour la lecture du code
❌ Couplé au concept “View” (moins abstrait)

👉 Bon choix si tu assumes que la composition est exclusivement View‑based.

🔵 3) Noms conceptuels / architecturaux (plus “framework”)
Mounts

✅ Très concis
✅ Très juste techniquement (mount / unmount)
✅ Bien aligné avec ton modèle DOM
❌ Un peu bas‑niveau / technique

👉 Excellent si tu veux assumer un vocabulaire “runtime”.

Layout

✅ Évoque la structure globale
❌ Ambigu avec le layout CSS
❌ Trop large

👉 Je ne recommande pas ici.

Region / Regions

✅ Héritage Marionette (que tu connais très bien)
✅ Correspond au modèle “slot + lifecycle”
❌ Peut sembler rétro / Backbone‑like

👉 Intéressant si tu assumes l’héritage Marionette (ce qui n’est pas un mal).

🔴 4) Noms que je déconseille (pour ton cas précis)
❌ Container

Trop générique
Ne dit rien du lifecycle

❌ Factory

Faux : il ne fait pas que créer

❌ Controller

Trop MVC
Mauvais signal architectural


⭐ Ma shortlist finale (ordre recommandé)
🥇 Children
👉 Mon favori
```typescript
this.children.sync();
this.children.detachAll();
```

Simple, lisible, évident.

🥈 Slots
👉 Si tu veux un vocabulaire très explicite
`this.slots.sync();`

🥉 Composer
👉 Si tu veux insister sur la responsabilité
`this.composer.sync();`

🧠 Détail subtil mais important : le type fait le travail
Tu peux te permettre un nom très court si le type est clair :
`protected readonly children: ViewChildren;`
ou
`protected readonly slots: ViewSlots;`
👉 Le contexte typé compense largement la concision.

✅ Recommandation finale (franche)
Si je me base sur :

ta volonté de simplicité,
ton rejet de la “View qui compose”,
ton modèle slot‑based,
ton souci de lisibilité long terme,

👉 je choisirais children.
C’est le nom qui :

ne sur‑vend rien,
ne sous‑entend pas de magie,
se lit naturellement,
et laisse le comportement parler.

Si tu veux, au prochain message je peux :

t’aider à renommer toute la section RFC autour de ce choix,
ou tester le nom dans des extraits de code pour voir “comment ça sonne” en pratique.

---

You said: J’aimais bien Node (noeud ) mais le type Node est déjà pris et c’est très générique

---
Copilot said: Oui — ton intuition est bonne : Node est sémantiquement juste, mais techniquement pollué et trop générique (DOM Node, AST Node, Graph Node, etc.). Tu fais bien de l’écarter comme nom public.
Du coup, la bonne question devient :

Quel nom garde l’idée de « nœud de composition »
sans entrer en collision sémantique ou technique ?

Voici des alternatives solides, classées par proximité avec “Node” et par lisibilité dans le code.

✅ 1) Alternatives directes à Node (même idée, moins générique)
Mount
👉 Mon favori dans ton contexte

✅ Très proche conceptuellement de Node
✅ Vocabulaire standard UI (mount / unmount)
✅ Très précis : point d’ancrage + lifecycle
✅ Aucune collision avec DOM types

```typescript
this.mount.sync();
this.mount.detach();
```

➡️ Excellent compromis entre justesse conceptuelle et concision.

MountPoint

✅ Encore plus explicite
✅ Très clair dans la doc
❌ Un peu plus long à l’usage

TypeScriptthis.mountPoint.sync();`
👉 Bon pour le RFC, un peu verbeux pour le runtime.

Anchor

✅ Très juste sémantiquement (point d’ancrage)
✅ Cohérent avec ton vocabulaire RootNode / ancrage DOM
❌ Un peu statique (moins “lifecycle” que Mount)

`this.anchor.sync();`
👉 Très bon si tu veux insister sur l’ancrage DOM, moins sur la création/destruction.

✅ 2) Noms qui expriment le rôle plutôt que la métaphore
Children
👉 (déjà évoqué, mais je le rementionne pour comparaison)

✅ Ultra lisible
✅ Zéro ambiguïté
❌ Perd la métaphore “node”

`this.children.sync();`
👉 Plus “API utilisateur”, moins “architecture”.

Slots

✅ Très moderne
✅ Exactement aligné avec “slot apparaît / disparaît”
✅ Parfait pour ton modèle “View informe / VCM agit”
❌ S’éloigne de l’idée de graphe/nœud

`this.slots.sync();`
👉 Idéal si tu assumes pleinement le modèle slot-based.

✅ 3) Noms inspirés des graphes / structures (plus abstraits)
Branch

✅ Métaphore naturelle avec “tree”
✅ Évoque clairement parent / enfant
❌ Peut suggérer un arbre strict (alors que tu es slot-based)

`this.branch.sync();`
👉 Intéressant, mais un peu trompeur conceptuellement.

Edge

✅ Graph theory pur
❌ Mauvais fit : Edge = relation, pas conteneur
❌ Trop abstrait

🚫 Je déconseille.

✅ 4) Variante élégante : garder Node… mais pas comme nom public
Si tu aimais vraiment Node, une bonne stratégie est :

Nom court côté View
Nom explicite côté type

Exemples :
`protected readonly mount: ViewNode;`
ou
`protected readonly node: ViewMount;`
👉 Le mot “Node” n’est plus exposé seul, il est qualifié, donc :

pas de collision mentale,
pas de confusion avec DOM Node,
tu conserves ton intuition initiale.


🏆 Ma shortlist finale (franche)
En tenant compte de :

ta recherche de concision,
ton rejet de la composition par la View,
ton modèle slot + lifecycle,
et le problème réel de Node,

🥇 Mount

Le meilleur remplaçant naturel de Node

🥈 Children

Le plus lisible dans le code

🥉 Slots

Le plus conceptuellement aligné avec ton design


✅ Recommandation finale (sans détour)
Si tu aimais Node pour de bonnes raisons, alors :

Mount est le nom que tu cherchais sans le savoir.

Il dit :

il y a un point,
il y a un cycle de vie,
il y a une responsabilité claire,
et ce n’est pas le DOM lui-même.

Si tu veux, je peux :

tester mount vs children dans plusieurs extraits réels,
ou t’aider à figer un vocabulaire officiel (Root / Mount / Slot / Child) pour toute la doc Bonsai.

Fournissez vos commentaires sur BizChatYou said: Du coup RootNode … Copilot said: CopilotOui — c’est exactement la bonne question à ce stade 👍
Si tu changes le vocabulaire autour de Node, RootNode doit être réaligné, sinon tu te retrouves avec une incohérence conceptuelle.
Je te fais une réponse courte, tranchée et structurante.

1) Le rôle réel de RootNode (clarifions-le)
Dans ton architecture, RootNode n’est PAS :

❌ un nœud logique de graphe,
❌ un composant métier,
❌ une View spéciale.

👉 C’est un point d’ancrage DOM + un propriétaire de lifecycle.
Autrement dit :

RootNode = le mount racine
VCM / Mount / Children = les mounts descendants

Donc si tu abandonnes Node pour Mount ailleurs, garder RootNode devient conceptuellement faux.

2) Le renommage le plus cohérent (mon avis net)
✅ RootMount
👉 Meilleur choix, sans hésitation

✅ Parfaitement aligné avec Mount
✅ Exprime exactement ce que c’est : le mount racine
✅ Aucun conflit avec DOM / AST / graph theory
✅ Très lisible dans le code et la doc

`const root = new RootMount(document.getElementById('app'));root.attach(View);Afficher plus de lignes
💡 Et surtout :

RootMount n’est pas un “nœud abstrait”,
c’est un point d’ancrage concret.


3) Autres options valables (mais moins parfaites)
🟡 AppMount

✅ Très clair fonctionnellement
✅ Bon pour la lisibilité produit
❌ Couplé à l’idée “une app = un mount” (alors que tu peux en avoir plusieurs)

`new AppMount(el);Afficher plus de lignes
👉 Bien si tu assumes un vocabulaire plus “application”.

🟡 RootAnchor

✅ Très juste sémantiquement
✅ Cohérent avec “ancrage DOM”
❌ Moins orienté lifecycle que Mount

👉 Bon si tu veux insister sur la stabilité du DOM plus que sur create/destroy.

🟠 RootContainer

❌ Trop générique
❌ Ne dit rien du lifecycle
❌ Déjà surchargé en frontend

👉 Je déconseille.

4) Cohérence globale recommandée (très important)
Si tu choisis Mount, voici un vocabulaire ultra propre et cohérent pour tout Bonsai :





























ConceptNomAncrage racineRootMountComposition enfantMount (ou children: Mount)Points de compositionSlotsActionmount / unmountRelationparent mount / child mount
Exemples naturels dans le code :
TypeScriptthis.mount.sync();this.mount.detachAll();rootMount.attach(MainView);Afficher plus de lignes
👉 Ça se lit comme de l’anglais, sans jargon.

5) Pourquoi ne pas garder RootNode même si tu aimes Node
Parce que tu as maintenant deux choses très différentes :

DOM Node (standard)
Bonsai “Node” (lifecycle owner)

Et ton framework fait justement un énorme effort pour :

éviter les ambiguïtés,
éviter la magie,
rendre le runtime lisible.

👉 Renommer ici, ce n’est pas cosmétique :
c’est une clarification architecturale majeure.

✅ Recommandation finale (sans détour)
Si tu adoptes :

Mount pour VCM / composition
Slots pour les points de présence

Alors le bon nom est :

🟢 RootMount

C’est le nom qui :

reflète exactement la responsabilité,
s’aligne avec tout le reste,
et vieillira bien dans la doc comme dans le code.

Si tu veux, au prochain message je peux :

te proposer un glossaire final Bonsai (RootMount / Mount / Slot / View),
ou relire une section RFC en vérifiant la cohérence terminologique de bout en bout.

---

- You said: En fait à réflexion je pense qu’il faudrait distinguer :
   - DomRoot : un composant racine qui a body et html comme éléments qu’il peut altérer et écouter mais aucune mutation des éléments enfants. Peut composer d’autres vues mais n’est pas instancié par une View parente donc le DOM est statique
   - rootMount : un composant qui a un rootElement comme noeud de référence et qui a les mêmes caractéristiques que DomRoot
   - Mont : là c’est un peu différent car une View est parente donc le DOM est réactif 
—-
Toujours en cours de réflexion l’idée de distinguer DomRoot et RootMount est d’éviter un god Object si trop de composition à partir d’un DoM statique

---


Copilot said: Ta réflexion est excellente, et surtout elle va dans le bon sens architecturalement :
tu es en train de séparer explicitement trois régimes de DOM au lieu de tout faire reposer sur un seul “Root” polymorphe → c’est exactement ce qui permet d’éviter le God Object.
Je vais :

reformuler proprement les 3 rôles que tu proposes (en corrigeant juste un point de vocabulaire),
valider pourquoi la distinction DomRoot / RootMount est saine,
te proposer un contrat clair pour chacun,
signaler les pièges à éviter,
conclure sur une terminologie stabilisée.


0) Petit point de vocabulaire (important)
Je suppose que Mont = Mount (typo).
Je vais utiliser Mount ci‑dessous.

1) Reformulation claire de ta proposition (elle est très bonne)
Tu distingues trois niveaux, non pas par “importance”, mais par nature du DOM qu’ils pilotent.
🟥 1. DomRoot

Le root absolu du document, au-dessus de toute View.

Caractéristiques

Référence : document.documentElement (<html>) et document.body
✅ Peut écouter des événements globaux (resize, scroll, visibility, etc.)
✅ Peut altérer html/body (classes globales, attributes, meta UX)
❌ Ne mute jamais les enfants directs (pas de projection fine)
✅ Peut composer des Views, mais :

n’est pas instancié par une View
le DOM sous-jacent est structurellement statique (SSR / CMS / shell)



👉 C’est un point d’orchestration, pas un composant UI.

🟧 2. RootMount

Un mount racine applicatif, mais localisé.

Caractéristiques

Référence : rootElement explicite (#app, #header, #sidebar, etc.)
✅ Même capacités que DomRoot :

écoute
lifecycle
composition


❌ Toujours DOM structurellement statique
✅ Peut instancier des Views racines
❌ N’est jamais enfant d’une View

👉 Différence clé avec DomRoot :
le périmètre DOM, pas le rôle.

🟩 3. Mount

Le mount réactif, contrôlé par une View parente.

Caractéristiques

✅ Instancié par une View
✅ DOM réactif / instable (apparition/disparition de slots)
✅ Piloté par la projection (PDR)
✅ Géré par le système de composition enfant (VCM / Children / Mount)
❌ Ne touche jamais au DOM hors de son slot

👉 C’est le seul niveau vraiment “dynamique”.

2) Pourquoi distinguer DomRoot et RootMount est une TRÈS bonne idée
Tu mets exactement le doigt sur le problème clé :

👉 éviter un God Object quand la composition démarre depuis un DOM statique

Sans distinction
Si DomRoot = RootMount = Mount :

un seul objet :

écoute tout
compose tout
projette partout


tentation naturelle :

“je vais juste rajouter un petit comportement ici”


résultat :

couplage implicite
logique globale + locale mélangée
debug pénible



Avec ta distinction
Tu obtiens trois zones de responsabilité étanches :





























NiveauDOMRéactivitéRisque God ObjectDomRootglobal❌❌ (orchestration only)RootMountlocal statique❌❌Mountlocal dynamique✅✅ mais contenu
👉 Le God Object devient structurellement impossible, pas juste “interdit par convention”.
C’est exactement ce qu’on cherche dans un framework opinionated.

3) Contrat clair pour chacun (à figer dans les RFC)
✅ DomRoot — Global Orchestrator
Responsabilités

Écoute globale (window, document)
État UX global (classes html/body)
Instanciation de RootMount(s)

Interdictions

❌ Projection DOM fine
❌ Gestion de slots dynamiques
❌ Être enfant de quoi que ce soit


✅ RootMount — Static Composition Root
Responsabilités

Ancrage local (rootElement)
Création/destruction de Views racines
Passage de contexte (Channels, config)

Interdictions

❌ DOM structurellement mutable
❌ Être créé par une View
❌ Réagir à la projection (pas de PDR)

👉 RootMount = frontière entre statique et réactif.

✅ Mount — Reactive Composition Unit
Responsabilités

Gérer des slots
Créer/détruire des Views enfants
Synchroniser avec la projection de la View parente

Interdictions

❌ Toucher au DOM hors slot
❌ Décider de son propre lifecycle
❌ Accéder à html/body


4) Point subtil mais IMPORTANT : causalité unidirectionnelle
Ta distinction permet un flux très propre :
DomRoot
   ↓ (instancie)
RootMount
   ↓ (instancie)
View
   ↓ (projection → signal slots)
Mount
   ↓ (compose)
Child Views

✅ Aucun niveau ne “remonte” la pile
✅ Aucune ambiguïté de responsabilité
✅ Debug évident (tu sais toujours “qui a le droit de faire quoi”)

5) Terminologie finale recommandée (cohérente et durable)
Je te propose de figer officiellement :





























ConceptNomDOM globalDomRootMount racine statiqueRootMountMount dynamiqueMountPoints d’insertionSlotsGestionnaire interneMount / Children (selon ton choix précédent)
👉 C’est :

cohérent,
lisible,
sans collision sémantique,
extensible (multi‑RootMount, micro‑frontends, etc.).


Conclusion (claire et franche)
✅ Ta distinction DomRoot / RootMount / Mount est architecturalement excellente
✅ Elle évite structurellement le God Object
✅ Elle clarifie la frontière statique ↔ réactif
✅ Elle s’aligne parfaitement avec :

la PDR,
le cycle de vie passif des Views,
la séparation View / composition.

👉 Tu es sur une très bonne trajectoire de design.
Si tu veux, au prochain message je peux :

te proposer une section RFC complète pour ces trois composants,
ou vérifier la cohérence avec Radio / Channels / lifecycle global,
ou t’aider à écrire un diagramme d’architecture final (ASCII ou visuel).

Fournissez vos commentaires sur BizChatHierYou said: Je cherche encore le nom de ces trois nouveaux composants, dans la même lignée que Feature, Entity, View, etc.Copilot said: CopilotTrès bien, là on n’est plus dans le quoi mais dans le langage du framework — et tu as raison d’être exigeant.
Les noms doivent :

être au même niveau conceptuel que Feature / Entity / View,
être simples, nominaux, non techniques (pas Manager, pas Controller),
exprimer une responsabilité claire, pas un mécanisme,
rester neutres et durables (pas trop DOM‑bas niveau, pas trop métaphoriques).

Je te propose donc une approche de nommage cohérente, puis plusieurs triplets complets, avec mon avis tranché à la fin.

1) Rappel du rôle des 3 composants (en une ligne chacun)
Pour bien nommer, je reformule de façon sémantique (pas technique) :


Composant A
→ représente l’application dans le document
(html / body, écoute globale, aucun DOM dynamique)


Composant B
→ représente un point d’entrée applicatif dans le DOM
(rootElement, DOM statique, instancie des Views)


Composant C
→ représente la composition dynamique d’une View
(slots, apparition/disparition, création/destruction de Views enfants)



2) Ce qu’on doit ABSOLUMENT éviter
Avant de proposer des noms, je pose des exclusions claires (dans la lignée de ton framework) :
❌ À éviter

Manager, Controller, Service, Container, Host
tout ce qui décrit comment plutôt que ce que c’est
les noms trop DOM (Element, Node, Tree)
les noms trop techniques (Renderer, Observer, MountPoint)

✅ À privilégier

noms nominaux, simples
déjà compréhensibles sans doc
compatibles avec une phrase du type :
“Une View est attachée à un …”


3) Axe de nommage recommandé : Structure / Portée / Composition
Dans Bonsai, tu as déjà :

Entity → structure de données
Feature → unité de logique
View → projection visuelle

Il manque donc logiquement des concepts de structure visuelle et de portée.

4) Triplets de noms cohérents (propositions)
🟢 OPTION 1 — Structure claire et très alignée (mon option préférée)

























RôleNom proposéPourquoiDOM globalDocumentNom naturel, non technique, évidentRoot statiqueSurfaceZone d’affichage stableComposition dynamiqueCompositionDit exactement la responsabilité
Lecture dans le code :
TypeScriptDocument  → Surface      → View          → Composition              → View enfantsAfficher plus de lignes
✅ Avantages

vocabulaire très “produit”
pas de collision DOM
extrêmement lisible

❌ Inconvénient

“Composition” est un peu abstrait (mais juste)


🟢 OPTION 2 — Encore plus proche de View / UI





















RôleNom proposéDOM globalShellRoot statiqueViewportComposition dynamiqueChildren
Lecture :
TypeScriptShell  → Viewport      → View          → ChildrenAfficher plus de lignes
✅ Très lisible
✅ Très UI
✅ Parfait pour expliquer “où s’affiche quoi”
❌ Viewport peut évoquer le responsive/layout
❌ Shell est un peu “frameworky”

🟢 OPTION 3 — Très conceptuel, très propre





















RôleNom proposéDOM globalApplicationRoot statiqueRegionComposition dynamiqueSlots
✅ Très proche de Marionette (héritage assumé)
✅ Parfait pour un framework structurant
❌ Region peut être perçu comme “old school”
❌ Application existe déjà comme composant (chez toi)

🟡 OPTION 4 — Si tu veux rester très proche de “Mount”





















RôleNom proposéDOM globalDocumentRootRoot statiqueRootSurfaceComposition dynamiqueSurface
❌ Un peu redondant
❌ Moins élégant
✅ Mais très cohérent sémantiquement

5) Ma recommandation nette (sans langue de bois)
Si je prends en compte :

ton rejet des God Objects,
ton souci de clarté,
la cohérence avec Feature / Entity / View,
la lisibilité à long terme pour une équipe,

👉 je recommande fortement le triplet suivant :
✅ Document / Surface / Composition
Pourquoi ?

Document
→ évident, universel, aucune ambiguïté
Surface
→ parfait pour un root DOM statique (zone d’affichage)
Composition
→ dit exactement ce que fait ce composant, sans jargon

C’est un vocabulaire :

neutre,
durable,
explicable en une phrase,
et surtout aligné avec l’intention, pas l’implémentation.


6) Test rapide “phrase de doc” (très révélateur)

Le Document représente l’intégration de l’application dans le DOM global.
Une Surface est un point d’entrée statique dans lequel une View est rendue.
Chaque View possède une Composition responsable de la création et destruction de ses sous‑Views.

👉 Si ça “sonne juste” à l’oral, c’est que le nom est bon.

7) Prochaine étape possible
Si tu veux, je peux :

relire tout ton vocabulaire Bonsai pour cohérence globale,
te proposer un glossaire officiel prêt à intégrer aux RFC,
ou t’aider à tester ces noms sur un extrait réel de code / doc.

Dis‑moi simplement quelle option te parle le plus instinctivement.
Fournissez vos commentaires sur BizChatYou said: J’ai peur qu’il y ait conflit de type entre Document (bonsaï) et Document (library dom)Copilot said: CopilotTu as entièrement raison d’avoir cette crainte — et elle est très saine.
Document est l’un des types les plus centraux et omniprésents du DOM, donc le conflit n’est pas seulement théorique, il est quotidien (types TS, imports, lisibilité mentale).
👉 Conclusion immédiate :
Document est un mauvais nom public pour Bonsai, même s’il est conceptuellement juste.
Mais la bonne nouvelle, c’est que tu es à un cheveu du bon vocabulaire. On peut corriger ça proprement sans perdre ton idée.

1) Pourquoi Document est réellement problématique (pas juste “un peu”)
❌ Conflit de type TypeScript
Dans un projet front sérieux, tu as partout :
TypeScriptdocument: DocumentAfficher plus de lignes
Introduire :
TypeScriptimport { Document } from 'bonsai';Afficher plus de lignes
implique :

shadowing,
alias (import { Document as BonsaiDocument }),
ou confusion silencieuse à la lecture.

👉 Très mauvais DX, surtout pour un framework qui prône la clarté.

❌ Conflit cognitif
Même sans collision technique, le cerveau du dev lit :

Document = DOM
Document (Bonsai) = orchestrateur applicatif

👉 Tu forces une surcharge mentale inutile, alors que ton architecture est justement pensée pour être lisible.

2) Le bon réflexe : garder l’idée, changer le mot
Ce que tu appelles Document n’est pas :

le DOM,
ni un wrapper du DOM,

c’est :

le composant racine qui relie l’application au document

Donc le mot clé n’est pas Document, mais relation au document.

3) Noms sûrs (sans collision DOM) — shortlist sérieuse
🥇 Shell ✅ (très bon candidat)
Pourquoi c’est excellent

Aucun conflit DOM
Très utilisé pour désigner un enveloppe applicative
Correspond parfaitement à ton rôle :

écoute globale
altération html/body
aucune projection fine
instancie des roots statiques



TypeScriptShell  → RootMount      → View          → MountAfficher plus de lignes
Phrase de doc naturelle

Le Shell représente l’intégration globale de l’application dans le document.

✅ Lisible
✅ Mature
✅ Durable

🥈 Host ✅ (techniquement juste, sobre)

Très utilisé pour désigner un environnement d’accueil
Zéro collision DOM
Un peu plus “technique” que Shell

TypeScriptHost  → RootMountAfficher plus de lignes
👉 Très bon si tu veux un vocabulaire sobre et framework-level.

🥉 Environment ✅ (plus conceptuel)

Désigne le contexte global (document, window, viewport)
Un peu plus abstrait
Peut inclure config, runtime flags, etc.

👉 Bon si tu veux élargir son rôle plus tard.

4) Ce que je te déconseille explicitement





























NomPourquoi❌ Documentcollision DOM + confusion mentale❌ DomRoottrop bas-niveau, trop technique❌ Applicationdéjà un autre concept chez toi❌ Roottrop générique❌ Contexttrop vague / surutilisé

5) Recomposition finale cohérente (recommandée)
En tenant compte :

de ta peur légitime du God Object,
de la distinction statique / réactif,
de la cohérence avec Feature / Entity / View,
et du conflit DOM,

👉 je recommande ce triplet final :





















RôleNomDOM global (html/body)ShellRoot statique localRootMountComposition dynamiqueMount
Lecture complète
Plain TextShell └─ RootMount (#app, #header, #sidebar…)     └─ View         └─ Mount (slots réactifs)             └─ View enfantsAfficher plus de lignes
👉 Aucun conflit DOM
👉 Aucune ambiguïté
👉 Chaque nom porte une responsabilité claire
👉 Impossible de faire un God Object sans violer la structure

6) Test ultime : “est-ce que ça se lit sans doc ?”

Le Shell instancie plusieurs RootMounts.
Un RootMount attache une View racine.
Chaque View délègue la composition dynamique à son Mount.

✅ Si ça “sonne juste”, tu es au bon endroit.

Si tu veux aller plus loin
Je peux :

figer un glossaire officiel Bonsai (1 phrase par concept),
relire tout le vocabulaire RFC pour éviter toute collision future,
ou tester ces noms dans un extrait d’API réel pour voir ce que ça donne “en pratique”.

Dis-moi juste : Shell te parle-t-il instinctivement ?
Fournissez vos commentaires sur BizChatAujourd’huiYou said: Non Shell ne reflète pas la notion de DOM. Viewport me plairait mais du coup c’est trop DOM. En fait je ne suis pas sûr des responsabilités de ce composant: serait-il capable d’instancier une View directement ? (Cas SPA avec du dom 100% dynamique ?) la possibilité d’instancier plusieurs RootMount est pour éviter d’avoir un seul objet pour déclarer trop de points de montages. Si moins de cinq-six noeuds de Mount Copilot said: CopilotTrès bien — là tu es au vrai point de bascule conceptuel, et ta gêne est le signal qu’il faut d’abord figer les responsabilités avant de figer les noms.
Je vais donc faire exactement ce que tu demandes implicitement :

clarifier ce que ce composant EST / N’EST PAS,
répondre clairement à la question “peut‑il instancier une View directement ?”,
stabiliser le modèle multi‑RootMount (éviter le God Object),
puis seulement proposer des noms qui tombent juste, sans trahir le DOM ni être trop bas‑niveau.


1) Tu as mis le doigt sur le vrai problème : ce composant n’est pas encore “conceptuellement fermé”
Ta phrase clé est celle‑ci :

je ne suis pas sûr des responsabilités de ce composant

👉 tant que ça n’est pas tranché, aucun nom ne sera satisfaisant
(et c’est exactement pour ça que Shell, Viewport, Document te gênent tous pour de bonnes raisons).
Donc commençons par figer le rôle, en répondant à la question centrale.

2) Question centrale :
👉 Ce composant peut‑il instancier une View directement ?
✅ Ma réponse nette : OUI, mais uniquement dans un cas précis
👉 Il peut instancier une View directement uniquement quand il est le dernier niveau statique.
C’est‑à‑dire :





















CasAutoriséSPA 100 % dynamique (pas de DOM applicatif existant)✅ OUIDOM statique + RootMounts explicites❌ NONComposition réactive (slots)❌ NON
Donc ce composant n’est pas un simple “orchestrateur abstrait” :
c’est le dernier rempart statique avant le réactif.

3) Redéfinition propre des 3 niveaux (après ta réflexion)
Je reformule strictement ce que tu es en train de concevoir — et c’est très cohérent.

🔴 Niveau 1 — DOM global, structure absolue
Responsabilité réelle

connaît document, html, body
peut écouter (resize, visibility, etc.)
peut altérer html/body uniquement
ne projette jamais
ne fait jamais de composition réactive

Peut instancier une View ?

✅ oui, mais seulement s’il n’existe aucun RootMount

👉 c’est le fallback SPA pur

🟠 Niveau 2 — DOM statique applicatif
C’est là que ta phrase est essentielle :

la possibilité d’instancier plusieurs RootMount est pour éviter un seul objet pour déclarer trop de points de montage

✅ Exactement.
Responsabilité réelle

référence un rootElement
DOM structurellement stable
instancie une View racine
ne réagit jamais à la projection
peut exister en plusieurs instances
ne dépend d’aucune View parente

👉 c’est le vrai “anti‑God Object”

🟢 Niveau 3 — DOM réactif, composition locale
Là, c’est clair et déjà très bien défini :

instancié par une View
DOM instable
slots
création/destruction dynamique
jamais racine
jamais global


4) Maintenant seulement : parlons noms (avec les responsabilités claires)
Tu veux :

rester dans la lignée Feature / Entity / View,
garder une relation claire au DOM,
sans collision (Document, Node),
sans trop bas‑niveau (DomRoot),
sans abstraction floue.


5) Noms proposés APRÈS clarification
✅ Pour le niveau 1 (DOM global)
Ce n’est ni un Shell, ni un Viewport, ni un Document.
C’est :

le point d’entrée DOM absolu

✅ RootDom (ou DomHost)

✅ explicite
✅ assumé DOM
✅ aucun conflit de type
✅ pas trop technique
✅ dit exactement ce que c’est

TypeScriptRootDom  └─ RootMount      └─ ViewAfficher plus de lignes
👉 RootDom est clair, honnête, sans prétendre être plus abstrait qu’il ne l’est.

✅ Pour le niveau 2 (DOM statique local)
Ton intuition était déjà juste.
✅ RootMount

parfaitement aligné
ni trop DOM, ni trop abstrait
explique naturellement le multi‑mount
empêche le God Object par construction

TypeScriptnew RootMount('#header');new RootMount('#main');new RootMount('#footer');Afficher plus de lignes

✅ Pour le niveau 3 (composition réactive)
On ne change rien à ce qui fonctionne bien.
✅ Mount

court
cohérent
lifecycle clair
vocabulaire universel (mount/unmount)


6) Modèle final recommandé (clair, lisible, robuste)
Plain TextRootDom ├─ RootMount (#header) │   └─ View │       └─ Mount (slots) ├─ RootMount (#main) │   └─ View │       └─ Mount └─ RootMount (#footer)Afficher plus de lignes
Cas SPA pur (DOM 100 % dynamique)
Plain TextRootDom └─ View     └─ MountAfficher plus de lignes
✅ même modèle
✅ pas de cas spécial
✅ pas de God Object
✅ pas de collision DOM
✅ vocabulaire homogène

7) Pourquoi Viewport ne marche pas (tu avais raison)
Tu l’as senti instinctivement :

Viewport = concept CSS / layout
toi tu parles de responsabilité de lifecycle
ce composant peut exister sans notion de viewport
il peut y en avoir plusieurs

👉 donc Viewport est trompeur, même s’il “sonne DOM”.

8) Conclusion (franche)
Tu es arrivé à une architecture très mature :

✅ séparation statique / réactif
✅ multi‑points d’ancrage
✅ aucun composant fourre‑tout
✅ vocabulaire aligné avec la responsabilité

✅ Je te recommande fermement :





















NiveauNomDOM globalRootDomDOM statique localRootMountDOM réactifMount
Si tu veux, prochain pas possible :

écrire le glossaire officiel Bonsai (1 phrase / composant),
vérifier la cohérence avec Application, Router, RootNode existants,
ou faire un diagramme final d’architecture prêt pour la RFC