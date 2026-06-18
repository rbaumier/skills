# Quotient familial et plafonnement

## Calcul des parts

Le quotient familial réduit le revenu taxable en augmentant le nombre de parts.

### Parts de base selon situation

| Situation | Parts de base |
|-----------|--------------|
| Célibataire, divorcé, séparé | 1 |
| Marié, pacsé (imposition commune) | 2 |
| Veuf sans enfant | 1 |
| Veuf avec enfant(s) | 2 (+ parts enfants) |

### Majoration pour enfants à charge

| Rang de l'enfant | Parts ajoutées |
|------------------|----------------|
| 1er enfant | +0,5 |
| 2ème enfant | +0,5 |
| 3ème enfant et suivants | +1 chacun |

**Cas particuliers** :
- Enfant en résidence alternée : moitié des valeurs ci-dessus (0,25 / 0,25 / 0,5)
- Enfant invalide (carte CMI-invalidité) : +0,5 part supplémentaire
- Parent isolé (case T, divorcé/veuf élevant seul des enfants) : +0,5 part sur le premier enfant

### Exemples

| Foyer | Parts |
|-------|-------|
| Célibataire sans enfant | 1 |
| Célibataire, 1 enfant | 1,5 (ou 2 si parent isolé) |
| Marié, 0 enfant | 2 |
| Marié, 2 enfants | 3 (2 + 0,5 + 0,5) |
| Marié, 3 enfants | 4 (2 + 0,5 + 0,5 + 1) |
| Marié, 1 enfant + 1 en résidence alternée | 2,75 (2 + 0,5 + 0,25) |

## Plafonnement du gain QF

**Mécanisme critique souvent oublié.** Le gain d'impôt lié aux demi-parts supplémentaires (enfants) est plafonné.

### Algorithme de vérification

```
impôt_avec_parts_pleines = calcul normal avec toutes les parts
impôt_sans_enfants       = calcul avec parts de base seulement (1 ou 2)
gain_réel = impôt_sans_enfants − impôt_avec_parts_pleines

plafond_par_demi_part = 1 807 €  (revenus 2025, voir data/bareme-ir-2025.json)
nb_demi_parts_supp = (nb_parts − parts_de_base) × 2
gain_max = plafond_par_demi_part × nb_demi_parts_supp

impôt_final = impôt_sans_enfants − min(gain_réel, gain_max)
```

### Conséquence pratique

Au-delà d'un certain seuil de revenu, **l'avantage fiscal stagne** même si le revenu augmente. Les enfants cessent de réduire l'impôt proportionnellement.

**Exemple (marié, 2 enfants, 2025)** :
- Parts pleines : 3 parts
- Demi-parts supplémentaires : (3 − 2) × 2 = 2 demi-parts
- Gain maximum : 2 × 1 807 € = **3 614 €**

Au-delà d'environ 90-100 k€ de RNI, le plafond devient actif et le gain QF stagne à 3 614 €.

### Pièges fréquents

1. **Oublier le plafonnement** : calculer l'IR avec 3 parts sans comparer au calcul à 2 parts + plafond.
2. **Appliquer le plafonnement sur 1 part** : non, il s'applique sur les demi-parts **supplémentaires** à la situation de base.
3. **Parent isolé** : la demi-part du parent isolé (case T) a son propre plafond, distinct.

## Décote

Mécanisme distinct du QF, appliqué **après** le plafonnement.

### Formules (revenus 2025)

Voir `data/bareme-ir-2025.json` → champ `decote`.

- **Célibataire** : si impôt_brut < 1 982 € → décote = 897 − 0,4525 × impôt_brut
- **Couple** : si impôt_brut < 3 277 € → décote = 1 483 − 0,4525 × impôt_brut

### Ordre d'application

```
Impôt brut (après barème)
  ↓ plafonnement QF
Impôt après QF
  ↓ décote (si applicable)
Impôt après décote
  ↓ réductions puis crédits
Impôt net
```

### Particularité : taux marginal effectif élevé

Dans la zone de décote, chaque euro supplémentaire de revenu :
- Augmente l'impôt au taux du barème
- Diminue la décote de 0,4525 × ce supplément

Taux marginal effectif ≈ (taux_barème × 1,4525). Un foyer à la tranche 11% peut subir un taux marginal effectif proche de 16% dans la zone de décote.

## Parent isolé (case T)

Majoration de 0,5 part pour les contribuables vivant seuls et élevant des enfants.

**Conditions** :
- Célibataire, divorcé ou séparé au 1er janvier
- Assume la charge exclusive ou principale d'au moins un enfant
- N'est pas en concubinage

**Plafonnement spécifique** : la demi-part "T" a son propre plafond (distinct du plafond par demi-part "enfant classique"). Vérifier sur impots.gouv.fr.

## Références CGI / BOFiP

- Parts : art. 194 à 195 CGI
- Plafonnement QF : art. 197-2 CGI
- Décote : art. 197-4° CGI
- Parent isolé : art. 194-II CGI
- BOFiP : BOI-IR-LIQ-10-20-20 et BOI-IR-LIQ-20-20-30
