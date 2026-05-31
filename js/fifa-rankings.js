/**
 * Classement FIFA masculin — mise à jour officielle du 1er avril 2026.
 * Source : FIFA/Coca-Cola World Ranking (fifa.com).
 * Clés = noms d'équipes du site (index.html GROUPS).
 */
(function (global) {
  global.CDM_FIFA_RANKS = {
    updated: '2026-04-01',
    label: 'Classement FIFA (1 avr. 2026)',
    ranks: {
      'France': 1,
      'Espagne': 2,
      'Argentine': 3,
      'Angleterre': 4,
      'Portugal': 5,
      'Brésil': 6,
      'Pays-Bas': 7,
      'Maroc': 8,
      'Belgique': 9,
      'Allemagne': 10,
      'Croatie': 11,
      'Colombie': 13,
      'Sénégal': 14,
      'Mexique': 15,
      'États-Unis': 16,
      'Uruguay': 17,
      'Japon': 18,
      'Suisse': 19,
      'Iran': 21,
      'Turquie': 22,
      'Équateur': 23,
      'Autriche': 24,
      'Corée du Sud': 25,
      'Australie': 27,
      'Algérie': 28,
      'Égypte': 29,
      'Canada': 30,
      'Norvège': 31,
      'Panama': 33,
      "Côte d'Ivoire": 34,
      'Suède': 38,
      'Paraguay': 40,
      'Rép. Tchèque': 41,
      'Écosse': 43,
      'Tunisie': 44,
      'RD Congo': 46,
      'Ouzbékistan': 50,
      'Qatar': 55,
      'Irak': 57,
      'Afrique du Sud': 60,
      'Arabie Saoudite': 61,
      'Jordanie': 63,
      'Bosnie Herzégovine': 65,
      'Cap Vert': 69,
      'Ghana': 74,
      'Curacao': 82,
      'Haïti': 83,
      'Nouvelle Zélande': 85,
    },
  };

  function getRank(teamName) {
    const r = global.CDM_FIFA_RANKS?.ranks?.[teamName];
    return typeof r === 'number' ? r : null;
  }

  global.CDM_FIFA = { getRank };
})(window);
