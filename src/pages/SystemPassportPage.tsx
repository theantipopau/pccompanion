import { Award, BadgeCheck, CircuitBoard, Cpu, FileClock, HardDrive, MonitorUp, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { useMonitor } from '../hooks/useMonitor';
import { computePerformanceScore } from '../lib/performanceScore';
import { getHardwareCapabilities } from '../services/systemService';
import type { HardwareCapability } from '../types/system';

export function SystemPassportPage() {
  const { systemInfo, sample, native } = useMonitor();
  const [capabilities, setCapabilities] = useState<HardwareCapability[]>([]);
  const score = computePerformanceScore(sample);

  useEffect(() => {
    let disposed = false;
    getHardwareCapabilities()
      .then((result) => {
        if (!disposed) setCapabilities(result);
      })
      .catch(() => {
        if (!disposed) setCapabilities([]);
      });
    return () => {
      disposed = true;
    };
  }, []);

  return (
    <div className="page">
      <PageHeader
        eyebrow="OEM identity"
        title="System Passport"
        description="Per-system identity, telemetry confidence, and deployment-grade readiness in a premium support format."
        action={
          <div className="passport-score-chip" title="Radium Performance Score">
            <span>Radium Score</span>
            <strong>{score.value}</strong>
            <small>{score.grade}</small>
          </div>
        }
      />

      {!native && (
        <div className="notice notice-preview">
          Browser preview mode. Passport values are generated from simulated telemetry.
        </div>
      )}

      <div className="passport-grid">
        <Panel className="passport-hero">
          <div className="passport-hero-top">
            <div>
              <span className="eyebrow">Identity status</span>
              <h2>Build profile verified</h2>
              <p>{score.summary}</p>
            </div>
            <div className="passport-grade-badge">Grade {score.grade}</div>
          </div>
          <div className="passport-pillars">
            {score.pillars.map((pillar) => (
              <div className="passport-pillar" key={pillar.id}>
                <strong>{pillar.label}</strong>
                <span>{pillar.score}/100</span>
                <small>{pillar.detail}</small>
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="passport-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">System fingerprint</span>
              <h2>Hardware identity</h2>
            </div>
            <BadgeCheck size={18} />
          </div>
          <dl className="passport-dl">
            <dt><Cpu size={15} /> CPU</dt>
            <dd>{systemInfo?.cpu ?? 'Pending detection'}</dd>
            <dt><MonitorUp size={15} /> GPU</dt>
            <dd>{systemInfo?.gpu ?? 'Pending detection'}</dd>
            <dt><CircuitBoard size={15} /> Motherboard</dt>
            <dd>{systemInfo?.motherboard ?? 'Pending detection'}</dd>
            <dt><HardDrive size={15} /> Storage</dt>
            <dd>{systemInfo?.storage?.join(' | ') ?? 'Pending detection'}</dd>
            <dt><FileClock size={15} /> BIOS</dt>
            <dd>{systemInfo?.bios ?? 'Pending detection'}</dd>
          </dl>
        </Panel>

        <Panel className="passport-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">OEM attestations</span>
              <h2>Deployment metadata</h2>
            </div>
            <Award size={18} />
          </div>
          <div className="passport-metadata-grid">
            <PassportField label="Passport ID" value="RDM-LOCAL-PENDING" />
            <PassportField label="System Serial" value="Pending OEM integration" />
            <PassportField label="Build Batch" value="Pending manufacturing feed" />
            <PassportField label="QC Seal" value="Pending validation workflow" />
            <PassportField label="Image Revision" value="Companion Phase 1 OEM" />
            <PassportField label="Support Tier" value="Radium Premium Care" />
          </div>
        </Panel>

        <Panel className="passport-panel wide">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Access confidence</span>
              <h2>Telemetry access matrix</h2>
            </div>
            <ShieldCheck size={18} />
          </div>
          <div className="passport-matrix">
            {capabilities.length > 0 ? capabilities.map((capability) => (
              <MatrixRow
                key={capability.id}
                label={capability.label}
                status={capability.state === 'live' ? 'live' : capability.state === 'unsupported' ? 'unsupported' : 'partial'}
                detail={`${capability.detail}${capability.writeSafe ? ' · write-safe' : ' · read-only'}`}
              />
            )) : (
              <MatrixRow label="Capability registry" status="partial" detail="Awaiting backend capability snapshot" />
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function PassportField({ label, value }: { label: string; value: string }) {
  return (
    <div className="passport-field">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function MatrixRow({ label, status, detail }: { label: string; status: 'live' | 'partial' | 'unsupported'; detail: string }) {
  return (
    <div className="passport-matrix-row">
      <div>
        <strong>{label}</strong>
        <small>{detail}</small>
      </div>
      <span className={status === 'live' ? 'matrix-state live' : status === 'unsupported' ? 'matrix-state unsupported' : 'matrix-state partial'}>{status === 'live' ? 'Live' : status === 'unsupported' ? 'Unsupported' : 'Partial'}</span>
    </div>
  );
}
