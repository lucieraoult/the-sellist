// Per-site field map. Each field is matched against the page's inputs by
// id / name / data-testid / placeholder / aria-label / <label> text (all lowercased,
// accents stripped). First matcher = most specific. These are best guesses that
// have not been checked against the live forms: when a site changes or a field
// is missed, adjust it here, the rest of the extension stays the same.
//
// kind:
//   text / textarea / price → value typed straight in
//   pick → a custom dropdown or typeahead: we click it, type the value, choose the
//          closest option; if that fails, the panel shows it as "à choisir"
//   info → never auto-filled (e.g. Vinted's category tree), shown in the panel to copy

// Vinted UK (vinted.co.uk) shows its form in English, so dropdown values from
// The Sellist (in French) are translated before we pick them. Keys are matched
// accent-insensitively, and a key found anywhere in the value counts
// ("Bleu délavé" → "Blue", "100 % coton" → "Cotton").
const SELLIST_EN = {
  "État": {
    "neuf avec etiquette": "New with tags", "neuf sans etiquette": "New without tags",
    "tres bon etat": "Very good", "bon etat": "Good", "satisfaisant": "Satisfactory"
  },
  "Couleur": {
    noir: "Black", blanc: "White", gris: "Grey", bleu: "Blue", marine: "Navy", rouge: "Red", rose: "Pink",
    vert: "Green", kaki: "Khaki", jaune: "Yellow", orange: "Orange", violet: "Purple", marron: "Brown",
    beige: "Beige", creme: "Cream", camel: "Camel", bordeaux: "Burgundy", dore: "Gold", argente: "Silver", multicolore: "Multi"
  },
  "Matière": {
    coton: "Cotton", lin: "Linen", laine: "Wool", cachemire: "Cashmere", soie: "Silk", cuir: "Leather",
    daim: "Suede", polyester: "Polyester", viscose: "Viscose", denim: "Denim", jean: "Denim", velours: "Velour", synthetique: "Synthetic"
  }
};

window.SELLIST_SITES = {
  vinted: {
    name: "Vinted",
    lang: () => window.SELLIST_FORCE_LANG || (/\.co\.uk$/.test(location.host) ? "en" : "fr"), // FORCE_LANG: mock page only
    translate: { en: SELLIST_EN },
    isForm: () => /\/items\/new/.test(location.pathname),
    fields: [
      { key: "titre", label: "Titre", kind: "text", match: ["title", "titre"] },
      { key: "description", label: "Description", kind: "textarea", match: ["description", "decris", "décris"] },
      { key: "Catégorie", label: "Catégorie", kind: "info", match: ["catalog", "categor"] },
      { key: "Marque", label: "Marque", kind: "pick", match: ["brand", "marque"] },
      { key: "Taille", label: "Taille", kind: "pick", match: ["size", "taille"] },
      { key: "État", label: "État", kind: "pick", match: ["status", "condition", "etat"] },
      { key: "Couleur", label: "Couleur", kind: "pick", match: ["color", "couleur"] },
      { key: "Matière", label: "Matière", kind: "pick", match: ["material", "matiere"] },
      { key: "Format du colis", label: "Format du colis", kind: "info", match: ["package", "colis"] },
      { key: "prix", label: "Prix", kind: "price", match: ["price", "prix"] }
    ]
  },
  vestiaire: {
    name: "Vestiaire Collective",
    // Vestiaire's deposit flow has several steps; we try to fill whatever step is showing.
    isForm: () => !!document.querySelector("input[type=file], textarea, input[name*=price i], input[id*=price i]"),
    fields: [
      { key: "description", label: "Description", kind: "textarea", match: ["description"] },
      { key: "Marque", label: "Marque", kind: "pick", match: ["brand", "designer", "marque", "createur", "créateur"] },
      { key: "Catégorie", label: "Catégorie", kind: "info", match: ["categor"] },
      { key: "Matière", label: "Matière", kind: "pick", match: ["material", "matiere"] },
      { key: "Couleur", label: "Couleur", kind: "pick", match: ["color", "colour", "couleur"] },
      { key: "Taille", label: "Taille", kind: "pick", match: ["size", "taille"] },
      { key: "État", label: "État", kind: "pick", match: ["condition", "etat"] },
      { key: "titre", label: "Titre", kind: "info", match: ["title", "titre"] },
      { key: "prix", label: "Prix", kind: "price", match: ["price", "prix"] }
    ]
  }
};
