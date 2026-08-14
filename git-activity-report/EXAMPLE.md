# Formats exacts à reproduire

Extraits anonymisés d'un rapport de référence. Reproduire ces formats à l'identique (alignement, séparateurs, légende).

## En-tête du rapport

```markdown
# Rapport d'activité git — voicehandler (natalia-core-rs)

**Période courante** : 2026-02-28 → 2026-05-29 (90 jours)
**Généré le** : 2026-05-29
**Rapports historiques disponibles** : 0 (premier rapport — baseline)
```

Quand des rapports historiques existent : `**Rapports historiques disponibles** : 2 (comparaison avec 2026-04-15)`.

## Heatmap journalière

Bloc de code brut. Une colonne de caractères par jour, groupées en semaines séparées par `|`. La première ligne indique les mois, alignée sur les semaines. Les noms d'identité sont paddés à largeur fixe pour que les grilles s'alignent.

```
                 | fév/mars            | mars                | mars/avril          | avril               | avril/mai           | mai                 | mai fin     |
Alice Martin     |       |       |    .  |  .    | ...   |..  .  |  .    |    .  |    .  |  ..   |  ..   |..     |  ...  |     |
Bob Durand       |       |       |       |       |       |       |       |       |       |       |       |       |     O |     |
Chloé P.         |       |  . o  |.      |       |       |       |       |       |       |   .   |       |       |       |     |
alicedev         |       |       |       |  .    |       |       |   .   |       |       |       |       |       |       |     |
```

Suivi de la légende, hors bloc de code :

```markdown
Légende : ` ` = 0 commit, `.` = 1-2, `o` = 3-9, `O` = 10-29, `#` = 30+
```
