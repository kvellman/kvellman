import type { InstallerInput, LocaleInput } from '#shared/manifest'

// Shared add/remove/default-locale operations for the manifest edit + create forms. State holds
// the full validated shapes (LocaleInput / InstallerInput); the field components coerce null↔''
// for display, so nothing extra is needed here.
export interface ManifestFormState {
  locales: LocaleInput[]
  installers: InstallerInput[]
}

export function emptyLocale(isDefault: boolean): LocaleInput {
  return {
    packageLocale: 'en-US',
    packageName: '',
    publisher: '',
    shortDescription: '',
    license: '',
    tags: [],
    isDefault,
  }
}
export function emptyInstaller(): InstallerInput {
  return { architecture: 'x64', installerType: 'exe', installerUrl: '', installerSha256: '' }
}

export function useManifestForm(state: ManifestFormState) {
  function addInstaller() {
    state.installers.push(emptyInstaller())
  }
  function removeInstaller(idx: number) {
    state.installers.splice(idx, 1)
  }
  function addLocale() {
    state.locales.push(emptyLocale(state.locales.length === 0))
  }
  function removeLocale(idx: number) {
    const wasDefault = state.locales[idx]?.isDefault
    state.locales.splice(idx, 1)
    if (wasDefault && state.locales[0]) state.locales[0].isDefault = true
  }
  // Radio-style: exactly one default locale.
  function setDefaultLocale(idx: number) {
    state.locales.forEach((l, i) => (l.isDefault = i === idx))
  }
  return { addInstaller, removeInstaller, addLocale, removeLocale, setDefaultLocale }
}
