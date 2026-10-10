# Site CV, Nathan Anciaux

Site statique d'une page, bilingue anglais / français. Aucune installation, aucun framework.

## Lancer en local

Depuis ce dossier :

```bash
python3 -m http.server 8000
```

puis ouvrir http://localhost:8000.

## Structure

```
index.html        la page, textes anglais par défaut
css/style.css     tout le style (couleurs et polices en haut, dans :root)
js/i18n.js        les textes des deux langues, une clé par attribut data-i18n
js/scene.js       le fond 3D : recuit simulé (Metropolis) sur un paysage d'énergie,
                  température et caméra pilotées par le défilement
js/main.js        langue, menu, défilement fluide, animations, compteurs, carrousel des projets
assets/           favicon, portrait.png (photo du CV), et le CV en PDF à déposer
```

**Projets** : carrousel horizontal (souris, doigt, trackpad, clavier). Chaque carte suit
le modèle de celle du recuit simulé, avec ses propres clés (ex. `auto.meta`, `auto.desc`) définies dans `js/i18n.js`.

## Versions

- **Palette « coolwarm, l'énergie », 1er octobre 2026** : fond noir d'origine `#0b0c0f` (essayé d'abord en `#1f2125` puis `#131417` le même jour), texte `#eff0f3`,
  accent bleu glacier `#9ec5ff`. Le paysage est coloré par l'énergie, carte divergente : bleu glacier aux minima,
  gris vers la médiane, rouge sur le haut de la cuvette, rouge sombre sur les crêtes et le plateau. Les chaînes
  restent lumineuses, le meilleur point en bleu. Réglages : `:root` de `css/style.css`, et en haut de
  `js/scene.js` `BG`, `ACCENT`, `RAMP` et la densité du brouillard (0,11). Le même jour, une variante sur fond
  clair (« coolwarm sur papier ») a été essayée, puis remplacée ; elle est dans `Site-CV-versions/v3-coolwarm-papier-2026-10-01/`.
- **Plan prolongé, même jour** : le paysage couvre tout l'écran. Hors du domaine des chaînes, il se prolonge
  sans nouveau minimum jusqu'à un plateau plat (`EXT`, `BAND`, `PLATEAU` dans `js/scene.js`).
- **Sauvegardes** : version sombre avec plan prolongé dans `Site-CV-versions/v2-sombre-plan-prolonge-2026-10-01/`,
  version sombre d'avant le plan prolongé dans `Site-CV-versions/v2-sombre-2026-10-01/`.
- **v2, actuelle** : fond 3D fixe (Three.js), recuit simulé qui refroidit à mesure qu'on descend, barre de bord en bas.
  Contenu mis à jour le 28 septembre 2026 depuis le CV Pages (photo, profil, stages, projets en carrousel,
  finance, entrepreneuriat) ; l'état d'avant est celui de `Site-CV-versions/v2-recuit-3d/`.
- **v1** : fond 2D limité au hero, Monte-Carlo du mouvement brownien géométrique.
  Sauvegardée dans `~/Documents/Nathan/Site-CV-versions/v1-brownien-2d/`, lançable avec
  `python3 -m http.server 8001 --directory ~/Documents/Nathan/Site-CV-versions/v1-brownien-2d`.

**Modifier un texte** : changer la valeur dans `js/i18n.js`, dans les deux langues, et la version anglaise dans `index.html` (celle qui s'affiche sans JavaScript).

## Bibliothèques, chargées depuis un CDN

- Three.js 0.180 : scène 3D du fond
- GSAP 3.13 et ScrollTrigger : apparitions au scroll, compteurs
- Lenis 1.3 : défilement fluide
- Polices Google Fonts : Instrument Serif, Inter, IBM Plex Mono

Si le CDN ne répond pas, la page reste entièrement lisible, sans animation.

## À compléter

- [ ] Liens LinkedIn et GitHub dans `index.html` (section Contact, `data-todo`)
- [ ] `assets/CV_Nathan_Anciaux.pdf`, le CV d'une page à jour
- [ ] Vérifier les faits : année du bac, « Top 10 % » en optimisation linéaire (6e sur 60)
- [x] Descriptions des projets automates, Jewels & Algorithms (Candy Crush), prédiction boursière (1er octobre 2026, depuis les consignes et les dépôts git)
- [x] Description du projet jeu de tentes (1er octobre 2026, depuis le dépôt `tents-d11`)
## Mise en ligne

GitHub Pages ou Vercel, gratuits tous les deux : il suffit de publier ce dossier tel quel.
