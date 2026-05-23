import type { Vendor } from '../types/system';

export const assets = {
  radiumHeader: new URL('../../images/radiumcompanion-header.png', import.meta.url).href,
  radiumLogo: new URL('../../images/radiumlogo.png', import.meta.url).href,
  trayBase: new URL('../../images/icon-source.png', import.meta.url).href,
  intel: new URL('../../images/clean/intel-transparent.png', import.meta.url).href,
  amd: new URL('../../images/clean/amd-transparent.png', import.meta.url).href,
  nvidia: new URL('../../images/clean/nvidia-transparent.png', import.meta.url).href,
  intelArc: new URL('../../images/intelarc.png', import.meta.url).href,
  radeon: new URL('../../images/radeon.png', import.meta.url).href,
  msi: new URL('../../images/msi.png', import.meta.url).href,
  asrock: new URL('../../images/asrock.png', import.meta.url).href,
  asus: new URL('../../images/asus.png', import.meta.url).href,
  appIcon: new URL('../../images/favicon.ico', import.meta.url).href,
};

export function vendorLogo(vendor: Vendor) {
  if (vendor === 'intel') return assets.intel;
  if (vendor === 'amd') return assets.amd;
  if (vendor === 'nvidia') return assets.nvidia;
  return assets.radiumLogo;
}

export function oemLogoForText(label: string) {
  const normalized = label.toLowerCase();
  if (normalized.includes('intel arc') || normalized.includes('arc')) return assets.intelArc;
  if (normalized.includes('radeon')) return assets.radeon;
  if (normalized.includes('nvidia') || normalized.includes('geforce')) return assets.nvidia;
  if (normalized.includes('intel')) return assets.intel;
  if (normalized.includes('amd') || normalized.includes('ryzen')) return assets.amd;
  if (normalized.includes('msi')) return assets.msi;
  if (normalized.includes('asrock')) return assets.asrock;
  if (normalized.includes('asus') || normalized.includes('rog')) return assets.asus;
  return null;
}
