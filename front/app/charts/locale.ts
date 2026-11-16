import { registerLocale } from 'echarts/core'
import type {
  ChartInitOptions,
  ChartLocale,
  ChartLocaleName,
} from '~~/types/charts'

export const frenchChartLocale: ChartLocale = {
  time: {
    month: [
      'janvier',
      'février',
      'mars',
      'avril',
      'mai',
      'juin',
      'juillet',
      'août',
      'septembre',
      'octobre',
      'novembre',
      'décembre',
    ],
    monthAbbr: [
      'janv.',
      'févr.',
      'mars',
      'avr.',
      'mai',
      'juin',
      'juil.',
      'août',
      'sept.',
      'oct.',
      'nov.',
      'déc.',
    ],
    dayOfWeek: [
      'dimanche',
      'lundi',
      'mardi',
      'mercredi',
      'jeudi',
      'vendredi',
      'samedi',
    ],
    dayOfWeekAbbr: ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'],
  },
  legend: { selector: { all: 'Tout', inverse: 'Inverser' } },
  toolbox: {
    brush: {
      title: {
        rect: 'Sélection rectangulaire',
        polygon: 'Sélection libre',
        lineX: 'Sélection horizontale',
        lineY: 'Sélection verticale',
        keep: 'Conserver la sélection',
        clear: 'Effacer la sélection',
      },
    },
    dataView: {
      title: 'Afficher les données',
      lang: ['Données', 'Fermer', 'Actualiser'],
    },
    dataZoom: { title: { zoom: 'Zoomer', back: 'Annuler le zoom' } },
    magicType: {
      title: {
        line: 'Courbe',
        bar: 'Barres',
        stack: 'Empiler',
        tiled: 'Juxtaposer',
      },
    },
    restore: { title: 'Rétablir' },
    saveAsImage: {
      title: 'Enregistrer en image',
      lang: ['Clic droit pour enregistrer'],
    },
  },
  series: {
    typeNames: {
      pie: 'graphique en anneau',
      bar: 'graphique en barres',
      line: 'courbe',
      scatter: 'nuage de points',
      effectScatter: 'nuage de points animé',
      radar: 'radar',
      tree: 'arbre',
      treemap: 'carte proportionnelle',
      boxplot: 'boîte à moustaches',
      candlestick: 'chandeliers',
      k: 'chandeliers',
      heatmap: 'carte de chaleur',
      map: 'carte',
      parallel: 'coordonnées parallèles',
      lines: 'lignes',
      graph: 'graphe',
      sankey: 'diagramme de Sankey',
      funnel: 'entonnoir',
      gauge: 'jauge',
      pictorialBar: 'barres illustrées',
      themeRiver: 'flux thématique',
      sunburst: 'diagramme rayonnant',
      custom: 'graphique personnalisé',
      chart: 'graphique',
    },
  },
  aria: {
    general: {
      withTitle: 'Graphique intitulé « {title} ».',
      withoutTitle: 'Graphique.',
    },
    series: {
      single: {
        prefix: '',
        withName: ' De type {seriesType}, nommé {seriesName}.',
        withoutName: ' De type {seriesType}.',
      },
      multiple: {
        prefix: ' Il comprend {seriesCount} séries.',
        withName:
          ' La série {seriesId}, de type {seriesType}, représente {seriesName}.',
        withoutName: ' La série {seriesId} est de type {seriesType}.',
        separator: { middle: '', end: '' },
      },
    },
    data: {
      allData: ' Données : ',
      partialData: ' Les {displayCnt} premières données : ',
      withName: '{name} : {value}',
      withoutName: '{value}',
      separator: { middle: ', ', end: '. ' },
    },
  },
}

registerLocale('FR', frenchChartLocale)

export function chartLocaleName(locale: string): ChartLocaleName {
  return locale === 'fr' ? 'FR' : 'EN'
}

export function chartInitOptions(locale: string): ChartInitOptions {
  return { renderer: 'svg', locale: chartLocaleName(locale) }
}
