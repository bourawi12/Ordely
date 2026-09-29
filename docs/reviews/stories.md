# Stories review: Ordely

I compared `docs/stories.md` (13 stories, s01 to s13) with `docs/prd.md`. I made no edits. The breakdown covers every core-loop and support feature in the PRD, and no story brings back anything from the graveyard. I found **4 major** and **9 minor** issues. None is critical, so the gate passes. The majors are worth fixing in `docs/stories.md` before `/ks-architect`, because each one will otherwise make a later phase (research or plan) guess.

## Perimeter coverage
| PRD feature (core loop) | Covered by | OK? |
|---|---|---|
| Préparer et lancer l'appel automatiquement (US10–US11) | s06-script-appel (US10), s07-appel-commande (US11 launch), s11-appels-automatiques (US11 automation) | ✅ |
| Conversation IA : identifier, présenter, confirmer/annuler, tunisien/français (US12–US16) | s06 (US12, US14), s09-conversation-tunisien (US13), s08-resultat-appel (US15, US16) | ✅ |
| Comprendre la réponse + clarification si ambiguë (US17–US18) | s08 (US17), s10-reponse-ambigue (US18) | ✅ |
| Appels sans réponse et échoués (US19–US20) | s12-sans-reponse-echecs (plus s07 for failures at launch) | ✅ |
| Statut de commande + résultat de l'appel (US21–US22) | s08 | ✅ |
| Support: Compte / connexion (US01–US02) | Already built, stated at the top of stories.md | ✅ |
| Support: Essai gratuit (US03) | s05-essai-gratuit | ✅ |
| Support: Infos entreprise (US04, US06) | s02-onboarding-boutique, s04-parametres-agent | ✅ |
| Support: Paramètres agent (US05, US29) | s02, s04 | ✅ |
| Support: Profil (US30) | s03-profil | ✅ |
| Success criterion "appel test sans aide" | s13-appel-test | ✅ |
| Kill mode "multi-boutiques" | s01-boutique-privee | ✅ |

- [x] Every feature of the PRD "Replicated (core loop)" table is delivered by at least one story

## Scope
- [x] No story reintroduces an item from the PRD graveyard. The carrier asked in s02 is information only (the notes say so). s01 and s13 touch the frozen dashboard, export and usage, but only to scope or exclude data, not to add tracking features. That is acceptable.
- [~] No story goes beyond the perimeter. s02 collects things the PRD does not mention (how the merchant found Ordely, delivery zones, volume band). See minor finding 1.

## Story quality
- [~] Each story is an end-to-end shippable slice. s06 is not (major finding 1).
- [~] Every acceptance criterion can become a test. Exceptions: s09 criterion 3 (major finding 4) and s06 criterion 4 (minor finding 3).
- [x] Agentic notes are present and useful in all 13 stories.
- [x] Every story has a complexity score, none is 5, and every 4 (s01, s07, s08, s09, s11) states its risk.

## The list as a whole
- [~] Dependency order: there is no cycle, but s10 points forward to s12 (major finding 3), and several dependencies are used without being declared (minor findings 5 to 7).
- [x] Ids are well-formed (`s<number>-<slug>`), unique and sequential from s01 to s13.
- [~] Overlap: s07 and s11 both claim "wait for the calling hours to open" (major finding 2). s07 and s12 overlap slightly on recording failures (minor finding 4).

## Findings

**Major**
1. **s06-script-appel is a technical layer.** Its only output is a generated script, tested "comme une fonction pure, sans fournisseur vocal". Nothing a user can see or hear exists until s07 places the call. It is the result of splitting the 5-point feature along a layer boundary, not a value boundary. Fix: merge it into s07, or give s06 something observable on its own, such as a script preview in settings.
2. **s07 and s11 claim the same slice.** s07 criterion 2 says an out-of-hours call "reste en attente jusqu'à l'ouverture de la plage". s11 criterion 5 says an order created out of hours "est appelée à l'ouverture de la plage suivante". Waiting for the window to open needs the scheduler that s11 introduces, so s07 either quietly builds half of s11 or relies on work scheduled after it. Fix: s07 only refuses or holds the call; s11 owns resuming at the next opening.
3. **s10 references s12, which comes later.** s10 criterion 2 needs the "à traiter" marker, but its notes say "réutiliser le même marqueur que s12 (définir le champ une seule fois)". s12 comes after s10, so it is unclear who creates the marker. Fix: s10 defines it and s12 reuses it (or reorder), and state that in both stories.
4. **s09-conversation-tunisien criterion 3 cannot become a test as written.** "Si le client répond dans une autre langue que celle de l'accueil, l'agent continue dans la langue du client" describes the live behaviour of an external voice model. The story's own notes say to measure on recorded transcripts, not real calls, and the simulated provider cannot show this. Fix: reword it as something checkable, such as the detected language recorded, or the script or prompt set up to switch language.

**Minor**
1. **s02** goes beyond the PRD's "Informations entreprise, complexité 2". It adds a marketing question, delivery zones, a volume band and carrier, which pushes the story to 3. That may be acceptable if the analysis dossier's US04/US06 include these fields, but it should be confirmed.
2. **s04** notes say the voice identifier is "validé plus tard" once the provider is chosen in s07. No criterion in s07 does that validation, so the promise has no owner.
3. **s06** criterion 4: "est signalée" does not say where or how (log, order flag, UI), so it cannot become a precise assertion.
4. **s07 / s12** overlap slightly. s07 criterion 4 records "échec" with a reason when launch fails. s12 criterion 4 records "échec" with a reason again. The split between launch errors and outcome errors plus retry policy should be stated.
5. **s09** is the quality bar for the classification that s08 already delivers. Its 50-scenario set includes an "ambiguïté" category before s10 exists, and s08 only classifies confirm and cancel. Say which story introduces the "ambigu" class.
6. **s10** uses s09's scenario set (per its notes) but only declares s08 as a dependency. Add s09.
7. **s11 and s12** have undeclared dependencies. s11 uses s05's trial quota; s12 needs s08's end-of-call event to learn about a no-answer. Both come earlier in the order, so nothing is broken, but the dependency lines are incomplete.
8. **s13** does not say what happens to a test call's result when the end-of-call event arrives. There is no persisted order, so s08's order-status update must not run. It also does not say whether the calling hours apply to test calls.
9. **s01 / s02**: accounts that already exist are moved to a default boutique by the migration. s02 will then force them through onboarding. No criterion covers this; worth stating on purpose.

Max severity: major
Stories ready: yes
