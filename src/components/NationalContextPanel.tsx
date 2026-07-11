import { ExternalLink, RadioTower, ShieldCheck, TrainFront, Waves, Droplets } from 'lucide-react'
import type { NationalContextFinding } from '../types/site'

const icons = {
  'drinking-water': Droplets,
  wastewater: Waves,
  broadband: RadioTower,
  'protected-lands': ShieldCheck,
  rail: TrainFront,
}

export function NationalContextPanel({ findings, showHeading = true }: { findings?: NationalContextFinding[]; showHeading?: boolean }) {
  if (!findings?.length) return null
  return (
    <section className="national-context-panel">
      {showHeading && <div className="subsection-heading"><span>National context</span><strong>Infrastructure & protected-land screen</strong></div>}
      <div className="national-context-grid">
        {findings.map((finding) => {
          const Icon = icons[finding.id]
          return <article key={finding.id} className={finding.status}>
            <div className="national-context-icon"><Icon size={17} /></div>
            <div>
              <span>{finding.label}<em>{finding.status.replace('-', ' ')}</em></span>
              <strong>{finding.summary}</strong>
              <p>{finding.detail}</p>
              {finding.actionUrl && <a href={finding.actionUrl} target="_blank" rel="noreferrer">Open official source <ExternalLink size={12} /></a>}
            </div>
          </article>
        })}
      </div>
      <small>These national layers are screening context. Local utilities, title records, managing agencies, and transportation operators remain authoritative.</small>
    </section>
  )
}
