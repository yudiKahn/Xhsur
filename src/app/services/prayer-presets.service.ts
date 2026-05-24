import { Injectable, inject } from '@angular/core';
import { PRAYER_PRESETS } from '../data/prayer-presets.data';
import { PRAYER_SECTIONS } from '../data/prayer-sections.data';
import {
  PrayerHtmlSectionDefinition,
  PrayerConditionRuleId,
  PrayerPresetDefinition,
  PrayerPresetSummary,
  PrayerPresetSectionRef,
  PrayerTimingFlags,
  ResolvedPrayerPreset,
  ResolvedPrayerSection,
} from '../models/prayer-preset.model';
import { PrayerTimingService } from './prayer-timing.service';

const sortSections = (sections: PrayerPresetSectionRef[]): PrayerPresetSectionRef[] =>
  [...sections].sort((left, right) => left.order - right.order);

@Injectable({
  providedIn: 'root',
})
export class PrayerPresetsService {
  private readonly prayerTimingService = inject(PrayerTimingService);

  getAll(): PrayerPresetSummary[] {
    const flags = this.prayerTimingService.getCurrentFlags();

    return [...PRAYER_PRESETS]
      .sort((left, right) => left.order - right.order)
      .map((preset) => this.resolvePreset(preset, flags))
      .filter((preset): preset is ResolvedPrayerPreset => preset !== undefined)
      .map((preset) => ({
        id: preset.id,
        titleKey: preset.titleKey,
        order: preset.order,
        initialSectionId: preset.initialSectionId,
        sections: preset.sections,
      }));
  }

  getById(id: string): ResolvedPrayerPreset | undefined {
    const preset = PRAYER_PRESETS.find((entry) => entry.id === id);
    if (!preset) {
      return undefined;
    }

    return this.resolvePreset(preset, this.prayerTimingService.getCurrentFlags());
  }

  private resolvePreset(
    presetDefinition: PrayerPresetDefinition,
    flags: PrayerTimingFlags,
  ): ResolvedPrayerPreset | undefined {
    const resolvedSections = sortSections(presetDefinition.sections)
      .map((sectionRef) => this.resolveSection(sectionRef, flags))
      .filter((section): section is ResolvedPrayerSection => section !== undefined);

    if (!resolvedSections.length) {
      return undefined;
    }

    return {
      id: presetDefinition.id,
      titleKey: presetDefinition.titleKey,
      order: presetDefinition.order,
      sections: resolvedSections,
      initialSectionId: resolvedSections[0].id,
    };
  }

  private resolveSection(
    sectionRef: PrayerPresetSectionRef,
    flags: PrayerTimingFlags,
  ): ResolvedPrayerSection | undefined {
    if (!this.matchesRule(sectionRef.includeWhen, flags)) {
      return undefined;
    }

    const sectionDefinition = this.getSectionDefinition(sectionRef.sectionId);
    if (!sectionDefinition) {
      throw new Error(`Unknown prayer section: ${sectionRef.sectionId}`);
    }

    if (!this.matchesRule(sectionDefinition.includeWhen, flags)) {
      return undefined;
    }

    return {
      id: sectionDefinition.id,
      titleKey: sectionRef.titleKey ?? sectionDefinition.titleKey,
      order: sectionRef.order,
      assetPath: sectionDefinition.assetPath,
      sourceFormat: sectionDefinition.sourceFormat ?? 'html',
      documentSectionId: sectionDefinition.documentSectionId,
      startHeading: sectionDefinition.startHeading,
      endHeading: sectionDefinition.endHeading,
    };
  }

  private matchesRule(
    ruleId: PrayerConditionRuleId | undefined,
    flags: PrayerTimingFlags,
  ): boolean {
    if (!ruleId) {
      return true;
    }

    switch (ruleId) {
      case 'show-tachanun':
        return flags.tachanun;
      case 'show-hallel-any':
        return flags.hallel !== 'none';
      case 'show-hallel-full':
        return flags.hallel === 'full';
      case 'show-hallel-partial':
        return flags.hallel === 'partial';
      default:
        return true;
    }
  }

  private getSectionDefinition(sectionId: string): PrayerHtmlSectionDefinition | undefined {
    return PRAYER_SECTIONS.find((section) => section.id === sectionId);
  }
}
