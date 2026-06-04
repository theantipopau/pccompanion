import { assets } from './assets';

const demoWordmark = new URL('../../images/demo/pc-companion-wordmark.svg', import.meta.url).href;
const demoMark = new URL('../../images/demo/pc-companion-mark.svg', import.meta.url).href;

export type BrandMode = 'radium' | 'demo';
export type BrandFeature = 'advancedSupport' | 'oemReporting' | 'demoPresentationMode' | 'simulationOnlySensitiveActions';

export type BrandFeatureFlags = Record<BrandFeature, boolean>;

export type BrandProfile = {
  mode: BrandMode;
  name: string;
  productName: string;
  shortName: string;
  website: string;
  websiteLabel: string;
  phone: string;
  salesEmail: string;
  supportEmail: string;
  companionEmail: string;
  operationsEmail: string;
  businessHours: string;
  address: string;
  companyDescription: string;
  supportSubject: string;
  companyLabel: string;
  contactPanelLabel: string;
  supportCtaLabel: string;
  supportTeamName: string;
  trustBadgeTitle: string;
  trustBadgeDetail: string;
  dashboardProofLine: string;
  dashboardProofTags: [string, string, string];
  readinessLabel: string;
  onboardingTitle: string;
  onboardingIntro: string;
  onboardingPassport: string;
  dashboardEyebrow: string;
  dashboardHeroTitle: string;
  sidebarPromoBody: string;
  settingsHeroTitle: string;
  settingsHeroBody: string;
  splashTagline: string;
  splashLogo: string;
  splashIcon: string;
  shellPromoAlt: string;
  features: BrandFeatureFlags;
};

const mode = (import.meta.env.VITE_BRAND_MODE ?? 'radium').toLowerCase() === 'demo' ? 'demo' : 'radium';

function getBrandProfile(currentMode: BrandMode): BrandProfile {
  if (currentMode === 'demo') {
    return {
      mode: 'demo',
      name: 'PC Companion',
      productName: 'PC Companion',
      shortName: 'PC Companion',
      website: 'https://example.com',
      websiteLabel: 'example.com',
      phone: '1300 000 000',
      salesEmail: 'sales@example.com',
      supportEmail: 'support@example.com',
      companionEmail: 'hello@example.com',
      operationsEmail: 'ops@example.com',
      businessHours: 'Mon-Fri, 9:00am-5:00pm',
      address: 'Australia',
      companyDescription: 'Custom builder demo profile for partner evaluations. Brand details, support channels, and copy can be replaced for each OEM.',
      supportSubject: 'PC Companion Support',
      companyLabel: 'PC Builder',
      contactPanelLabel: 'Demo Contact',
      supportCtaLabel: 'Get Help',
      supportTeamName: 'PC Companion team',
      trustBadgeTitle: 'Demo ready',
      trustBadgeDetail: 'Local telemetry preview with support-style reports',
      dashboardProofLine: 'Local-first hardware care workflow',
      dashboardProofTags: ['Neutral', 'Private', 'Support-ready'],
      readinessLabel: 'Care',
      onboardingTitle: 'Welcome to PC Companion',
      onboardingIntro: 'Companion is your local hub for telemetry, support diagnostics, cleanup, and performance profiles.',
      onboardingPassport: 'System Passport and Telemetry Diagnostics keep useful build information close by if you ever need support.',
      dashboardEyebrow: 'PC Companion',
      dashboardHeroTitle: 'Performance Score',
      sidebarPromoBody: 'Premium local support, diagnostics-first workflows, and lifecycle-safe tuning in one desktop suite.',
      settingsHeroTitle: 'Built for your custom PC',
      settingsHeroBody: 'Companion brings local telemetry, support diagnostics, safe cleanup tools, performance profiles, and ownership workflows together for gaming and workstation systems.',
      splashTagline: 'System Performance Suite',
      splashLogo: demoWordmark,
      splashIcon: demoMark,
      shellPromoAlt: 'PC Companion support panel',
      features: {
        advancedSupport: false,
        oemReporting: false,
        demoPresentationMode: true,
        simulationOnlySensitiveActions: true,
      },
    };
  }

  return {
    mode: 'radium',
    name: 'Radium PCs',
    productName: 'Radium PCs Companion',
    shortName: 'Companion',
    website: 'https://radiumpcs.com.au',
    websiteLabel: 'radiumpcs.com.au',
    phone: '1300 935 884',
    salesEmail: 'sales@radiumpcs.com.au',
    supportEmail: 'support@radiumpcs.com.au',
    companionEmail: 'companion@radiumpcs.com.au',
    operationsEmail: 'operations@radiumpcs.com.au',
    businessHours: 'Mon-Fri, 9:30am-5:30pm',
    address: '207 Hyde St, Yarraville VIC 3013, Australia',
    companyDescription: 'Melbourne-based builders of custom and prebuilt gaming PCs, workstations, and water-cooled systems for Australian customers.',
    supportSubject: 'Radium PCs Companion Support',
    companyLabel: 'Radium PCs',
    contactPanelLabel: 'Radium PCs Contact',
    supportCtaLabel: 'Get Support',
    supportTeamName: 'Radium PCs team',
    trustBadgeTitle: 'Radium validated',
    trustBadgeDetail: 'Local-first telemetry and support-ready reports',
    dashboardProofLine: 'Local-first premium support workflow',
    dashboardProofTags: ['Validated', 'Private', 'Support-ready'],
    readinessLabel: 'Support',
    onboardingTitle: 'Welcome to Radium PCs Companion',
    onboardingIntro: 'Thanks for purchasing a Radium PCs custom build. Companion is your local hub for telemetry, support diagnostics, cleanup, and performance profiles.',
    onboardingPassport: 'System Passport and Telemetry Diagnostics keep useful build information close by if you ever need help from the Radium PCs team.',
    dashboardEyebrow: 'Radium PCs Companion',
    dashboardHeroTitle: 'Radium Performance Score',
    sidebarPromoBody: 'Premium local support, diagnostics-first workflows, and lifecycle-safe tuning in one desktop suite.',
    settingsHeroTitle: 'Built for your Radium custom PC',
    settingsHeroBody: 'Companion brings local telemetry, support diagnostics, safe cleanup tools, performance profiles, and ownership workflows together for Radium PCs gaming and workstation systems.',
    splashTagline: 'System Performance Suite',
    splashLogo: assets.radiumHeader,
    splashIcon: assets.radiumLogo,
    shellPromoAlt: 'Radium Companion premium support panel',
    features: {
      advancedSupport: true,
      oemReporting: true,
      demoPresentationMode: false,
      simulationOnlySensitiveActions: false,
    },
  };
}

export const brand = getBrandProfile(mode);
export const brandMode = mode;

export function isFeatureEnabled(feature: BrandFeature): boolean {
  return brand.features[feature];
}
