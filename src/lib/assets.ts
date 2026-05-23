import type { Vendor } from '../types/system';

export const assets = {
  radiumHeader: new URL('../../images/radiumcompanion-header.png', import.meta.url).href,
  radiumLogo: new URL('../../images/radiumlogo.png', import.meta.url).href,
  trayBase: new URL('../../images/icon-source.png', import.meta.url).href,
  intel: new URL('../../images/clean/intel-transparent.png', import.meta.url).href,
  amd: new URL('../../images/clean/amd-transparent.png', import.meta.url).href,
  nvidia: new URL('../../images/clean/nvidia-transparent.png', import.meta.url).href,
  appIcon: new URL('../../images/favicon.ico', import.meta.url).href,
};

export function vendorLogo(vendor: Vendor) {
  if (vendor === 'intel') return assets.intel;
  if (vendor === 'amd') return assets.amd;
  if (vendor === 'nvidia') return assets.nvidia;
  return assets.radiumLogo;
}
