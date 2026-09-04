import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { usePWAInstall } from '../hooks/usePWA'
import { classNames } from '../utils/helpers'
import { IconCheck, IconBack, IconDevice, IconDownload } from '../components/common/Icons'

export default function Settings() {
  const { settings, updateSettings } = useApp()
  const { canInstall, installed, promptInstall } = usePWAInstall()
  const navigate = useNavigate()

  return (
    <div className="px-4 md:px-10 pt-24 max-w-2xl mx-auto pb-16">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="glass rounded-full p-2 hover:bg-white/15 transition-colors"
          aria-label="Back"
        >
          <IconBack width={16} height={16} />
        </button>
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Settings</h1>
      </div>

      <div className="space-y-4 mt-8">
        <Section title="App">
          <div className="flex items-center justify-between gap-4 py-1">
            <div>
              <p className="text-sm font-semibold">Install Vesper App</p>
              <p className="text-xs text-muted mt-0.5">
                {installed
                  ? "Installed — you're running the progressive web app right now."
                  : 'Add Vesper to your home screen or desktop for full-screen offline mode.'}
              </p>
            </div>
            {installed ? (
              <span className="flex items-center gap-1.5 text-emerald-400 text-sm font-semibold">
                <IconCheck width={16} height={16} /> Installed
              </span>
            ) : canInstall ? (
              <button
                onClick={async () => {
                  await promptInstall()
                }}
                className="btn-shimmer flex items-center gap-2 bg-gradient-to-r from-brand2 to-brand px-4 py-2 rounded-xl text-sm font-bold"
              >
                <IconDevice width={15} height={15} /> Install
              </button>
            ) : (
              <span className="text-xs text-muted">Use browser "Add to Home Screen"</span>
            )}
          </div>
        </Section>

        <Section title="Playback">
          <Row label="Autoplay next episode" hint="Automatically proceed to the next episode when watching TV series">
            <Toggle
              on={settings.autoplayNext}
              onChange={(v) => updateSettings({ autoplayNext: v })}
            />
          </Row>
        </Section>

        <Section title="Download Server">
          <div className="py-1 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold flex items-center gap-2">
                  <IconDownload width={15} height={15} className="text-brand" />
                  Vesper High-Speed Batch Downloader
                </p>
                <p className="text-xs text-muted mt-0.5">
                  Server-powered batch downloads process movie & episode queues directly on the cloud backend.
                </p>
              </div>
            </div>
            <div className="bg-surface2/80 rounded-xl p-3 border border-line/50 text-xs text-muted flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <span>Cloud batch server is active & connected.</span>
            </div>
          </div>
        </Section>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass rounded-2xl p-5">
      <h2 className="text-xs font-bold text-muted uppercase tracking-wider mb-4">{title}</h2>
      <div className="space-y-4">{children}</div>
    </div>
  )
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-semibold">{label}</p>
        {hint && <p className="text-xs text-muted mt-0.5">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={classNames(
        'w-11 h-6 rounded-full relative transition-colors',
        on ? 'bg-gradient-to-r from-brand2 to-brand' : 'bg-surface2 border border-line'
      )}
    >
      <span
        className={classNames(
          'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all',
          on ? 'left-[22px]' : 'left-0.5'
        )}
      />
    </button>
  )
}
