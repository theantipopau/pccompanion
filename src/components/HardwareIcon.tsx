/**
 * HardwareIcon — Custom precision SVG icons for hardware telemetry UI.
 * All icons share a 24×24 viewBox, 1.5px strokes, and an industrial-minimal
 * design language distinct from generic Lucide icons.
 */

type IconProps = {
  size?: number;
  color?: string;
  className?: string;
  strokeWidth?: number;
};

function Icon({ size = 20, color = 'currentColor', className, strokeWidth = 1.5, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

/** CPU chip with pins on four sides */
export function CpuIcon(props: IconProps) {
  return (
    <Icon {...props}>
      {/* Die */}
      <rect x="7" y="7" width="10" height="10" rx="1.5" />
      {/* Inner die mark */}
      <rect x="9.5" y="9.5" width="5" height="5" rx="0.5" strokeOpacity={0.4} />
      {/* Left pins */}
      <path d="M4 9.5h3M4 12h3M4 14.5h3" />
      {/* Right pins */}
      <path d="M17 9.5h3M17 12h3M17 14.5h3" />
      {/* Top pins */}
      <path d="M9.5 4v3M12 4v3M14.5 4v3" />
      {/* Bottom pins */}
      <path d="M9.5 17v3M12 17v3M14.5 17v3" />
    </Icon>
  );
}

/** Discrete GPU card — PCB body + twin fans + bracket */
export function GpuIcon(props: IconProps) {
  return (
    <Icon {...props}>
      {/* PCB body */}
      <rect x="2" y="9" width="20" height="10" rx="1.5" />
      {/* Fan circles */}
      <circle cx="8" cy="14" r="2.8" />
      <circle cx="16" cy="14" r="2.8" />
      {/* Fan hubs */}
      <circle cx="8"  cy="14" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="16" cy="14" r="0.8" fill="currentColor" stroke="none" />
      {/* PCIe bracket */}
      <rect x="2" y="4.5" width="2.5" height="4.5" rx="0.75" />
      {/* Display output stubs */}
      <path d="M7 9V6.5M10.5 9V6.5M14 9V6.5" />
    </Icon>
  );
}

/** RAM DIMM module */
export function RamIcon(props: IconProps) {
  return (
    <Icon {...props}>
      {/* Module body */}
      <rect x="3" y="5" width="18" height="12" rx="1" />
      {/* Connector notch */}
      <path d="M10 17v2.5M14 17v2.5" />
      {/* Memory chips (3 dots) */}
      <rect x="5.5" y="8" width="3" height="3" rx="0.5" strokeOpacity={0.5} />
      <rect x="10.5" y="8" width="3" height="3" rx="0.5" strokeOpacity={0.5} />
      <rect x="15.5" y="8" width="3" height="3" rx="0.5" strokeOpacity={0.5} />
    </Icon>
  );
}

/** NVMe SSD — blade form factor */
export function NvmeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      {/* PCB blade */}
      <rect x="2" y="9" width="18" height="6" rx="1" />
      {/* M.2 connector */}
      <rect x="20" y="10.5" width="2" height="3" rx="0.5" />
      {/* Controller chip */}
      <rect x="5" y="11" width="4" height="2" rx="0.5" strokeOpacity={0.5} />
      {/* NAND chip */}
      <rect x="11" y="11" width="5" height="2" rx="0.5" strokeOpacity={0.5} />
    </Icon>
  );
}

/** HDD platter drive */
export function HddIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      {/* Platter */}
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
      {/* Read arm */}
      <path d="M14.8 9.2l2-2" />
    </Icon>
  );
}

/** Axial case fan */
export function FanIcon(props: IconProps) {
  return (
    <Icon {...props}>
      {/* Outer ring */}
      <circle cx="12" cy="12" r="9" />
      {/* Inner bearing */}
      <circle cx="12" cy="12" r="2" />
      {/* 4 blades */}
      <path d="M12 10 C11 8 9 7.5 8.5 9.5 C8 11.5 10 11 12 10Z" strokeOpacity={0.6} />
      <path d="M14 12 C16 11 16.5 9 14.5 8.5 C12.5 8 13 10 14 12Z" strokeOpacity={0.6} />
      <path d="M12 14 C13 16 15 16.5 15.5 14.5 C16 12.5 14 13 12 14Z" strokeOpacity={0.6} />
      <path d="M10 12 C8 13 7.5 15 9.5 15.5 C11.5 16 11 14 10 12Z" strokeOpacity={0.6} />
    </Icon>
  );
}

/** Thermal / temperature sensor */
export function ThermalIcon(props: IconProps) {
  return (
    <Icon {...props}>
      {/* Thermometer body */}
      <path d="M12 13.5V5a1 1 0 0 0-2 0v8.5" />
      <path d="M11 13.5a3 3 0 1 0 2 0" />
      {/* Tick marks */}
      <path d="M13 7h1.5M13 9.5h1.5M13 12h1.5" strokeOpacity={0.5} />
    </Icon>
  );
}

/** Wi-Fi antenna signal icon */
export function WifiIcon(props: IconProps) {
  return (
    <Icon {...props}>
      {/* 3 arcs */}
      <path d="M4.9 7.9a10 10 0 0 1 14.2 0" />
      <path d="M7.7 10.7a6 6 0 0 1 8.6 0" />
      <path d="M10.5 13.5a2.5 2.5 0 0 1 3 0" />
      <circle cx="12" cy="17" r="1" fill="currentColor" stroke="none" />
    </Icon>
  );
}

/** Ethernet / LAN connector */
export function EthernetIcon(props: IconProps) {
  return (
    <Icon {...props}>
      {/* Connector housing */}
      <rect x="6" y="7" width="12" height="13" rx="1.5" />
      {/* RJ-45 contacts */}
      <path d="M8.5 11h1M10.5 11h1M12.5 11h1M14.5 11h1" strokeWidth={1.2} />
      {/* Latch tab */}
      <path d="M9 20v2M15 20v2" />
      {/* Cable */}
      <path d="M12 7V4" />
    </Icon>
  );
}

/** PSU / power unit */
export function PowerIcon(props: IconProps) {
  return (
    <Icon {...props}>
      {/* Box */}
      <rect x="3" y="6" width="18" height="13" rx="1.5" />
      {/* Fan hole */}
      <circle cx="8" cy="12" r="2.5" />
      <circle cx="8" cy="12" r="0.8" fill="currentColor" stroke="none" />
      {/* Connectors on right */}
      <path d="M15 9h4M15 12h4M15 15h4" strokeWidth={1.2} />
    </Icon>
  );
}

/** VRAM — stacked memory dies */
export function VramIcon(props: IconProps) {
  return (
    <Icon {...props}>
      {/* Three stacked chips (HBM / GDDR visualization) */}
      <rect x="4" y="14" width="16" height="4"  rx="1" />
      <rect x="4" y="10" width="16" height="3.5" rx="1" strokeOpacity={0.65} />
      <rect x="4" y="6"  width="16" height="3.5" rx="1" strokeOpacity={0.35} />
      {/* Stack connectors */}
      <path d="M8 14v-.5M12 14v-.5M16 14v-.5" strokeOpacity={0.5} />
    </Icon>
  );
}

/** Network throughput — up/down arrows */
export function NetworkIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8 3L5 6l3 3" />
      <path d="M5 6h9a4 4 0 0 1 0 8H5" />
      <path d="M16 21l3-3-3-3" />
      <path d="M19 18H10a4 4 0 0 1 0-8h9" />
    </Icon>
  );
}
