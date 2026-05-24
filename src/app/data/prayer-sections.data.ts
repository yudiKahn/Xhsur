import { PrayerHtmlSectionDefinition } from '../models/prayer-preset.model';

const sectionAsset = (id: string): string => `assets/siddur/sections/${id}.html`;
const prayerSourceAsset = (id: string): string => `assets/siddur/source/${id}.txt`;
const shachritAssetPath = prayerSourceAsset('shachrit');

export const PRAYER_SECTIONS: PrayerHtmlSectionDefinition[] = [
  {
    id: 'birkot-hashachar',
    titleKey: 'presets.shacharit.sections.birkotHashachar',
    assetPath: shachritAssetPath,
    sourceFormat: 'text',
    documentSectionId: 'birkot-hashachar',
  },
  {
    id: 'korbanot',
    titleKey: 'presets.shacharit.sections.korbanot',
    assetPath: shachritAssetPath,
    sourceFormat: 'text',
    documentSectionId: 'korbanot',
  },
  {
    id: 'hodu',
    titleKey: 'presets.shacharit.sections.hodu',
    assetPath: shachritAssetPath,
    sourceFormat: 'text',
    documentSectionId: 'hodu',
  },
  {
    id: 'yishtabach',
    titleKey: 'presets.shacharit.sections.yishtabach',
    assetPath: shachritAssetPath,
    sourceFormat: 'text',
    documentSectionId: 'yishtabach',
  },
  {
    id: 'tefilat-haderech',
    titleKey: 'presets.tefilatHaderech.sections.main',
    assetPath: sectionAsset('tefilat-haderech'),
  },
  {
    id: 'birkat-hamazon',
    titleKey: 'presets.birkatHamazon.sections.main',
    assetPath: sectionAsset('birkat-hamazon'),
  },
  {
    id: 'ashrei',
    titleKey: 'presets.mincha.sections.ashrei',
    assetPath: sectionAsset('ashrei'),
  },
  {
    id: 'maariv-main',
    titleKey: 'presets.maariv.sections.main',
    assetPath: sectionAsset('maariv-main'),
  },
  {
    id: 'kriat-shema-al-hamita',
    titleKey: 'presets.kriatShemaAlHamita.sections.main',
    assetPath: sectionAsset('kriat-shema-al-hamita'),
  },
  {
    id: 'tachanun',
    titleKey: 'presets.shared.sections.tachanun',
    assetPath: sectionAsset('tachanun'),
    includeWhen: 'show-tachanun',
  },
  {
    id: 'hallel',
    titleKey: 'presets.shared.sections.hallel',
    assetPath: sectionAsset('hallel'),
    includeWhen: 'show-hallel-any',
  },
];
