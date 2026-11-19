import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Check,
  Clipboard,
  Download,
  ExternalLink,
  FileArchive,
  GitBranch,
  LoaderCircle,
  Smartphone,
  WifiOff
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import { spring, Modal } from './ui'

const REPO = 'kennedy-blip/matatupulse'
const LOCAL_APK = '/downloads/matatupulse.apk'
const RELEASES_URL = `https://github.com/${REPO}/releases`
const WORKFLOW_URL = `https://github.com/${REPO}/actions/workflows/android-apk.yml`
const BUILD_COMMAND = 'npm ci && npm run build && npx cap sync android && cd android && ./gradlew assembleDebug'

async function findLocalApk() {
  try {
    const response = await fetch(LOCAL_APK, { method: 'HEAD', cache: 'no-store' })
    const type = response.headers.get('content-type') || ''
    if (response.ok && !type.includes('text/html')) return { url: LOCAL_APK, source: 'Bundled with this deployment', size: Number(response.headers.get('content-length')) || null }
  } catch {
    // A HEAD failure simply means the self-hosted file is absent.
  }
  return null
}

async function findReleaseApk() {
  try {
    const response = await fetch('https://api.github.com/repos/' + REPO + '/releases/latest', { headers: { Accept: 'application/vnd.github+json' } })
    if (!response.ok) return null
    const release = await response.json()
    const asset = (release.assets || []).find((item) => item.name === 'matatupulse.apk' || item.name?.endsWith('.apk'))
    if (!asset) return null
    return { url: asset.browser_download_url, source: `GitHub release ${release.tag_name || 'latest'}`, size: asset.size || null, version: release.tag_name }
  } catch {
    return null
  }
}

function formatSize(bytes) {
  if (!bytes) return null
  if (bytes > 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${Math.round(bytes / 1024)} KB`
}

function Step({ number, title, command, onCopy }) {
  return (
    <div className="rounded-xl border border-hairline bg-[var(--chip)] p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold text-ink"><span className="mr-2 text-brand-amber">{number}.</span> {title}</p>
        <button className="btn btn-ghost !px-2 !py-1 !text-[10px]" onClick={() => onCopy(command)}><Clipboard size={11} /> Copy</button>
      </div>
      <code className="mt-2 block overflow-x-auto whitespace-pre rounded-lg bg-[var(--field)] p-2 font-mono text-[10px] leading-4 text-muted">{command}</code>
    </div>
  )
}

export default function DownloadAPKModal({ className = '' }) {
  const { notify, online } = useApp()
  const [open, setOpen] = useState(false)
  const [state, setState] = useState({ status: 'idle', url: null, source: null, size: null })

  useEffect(() => {
    if (!open || state.status !== 'idle') return
    let cancelled = false
    const check = async () => {
      setState({ status: 'checking', url: null, source: null, size: null })
      const local = await findLocalApk()
      if (cancelled) return
      if (local) {
        setState({ status: 'available', ...local })
        return
      }
      const release = online ? await findReleaseApk() : null
      if (cancelled) return
      setState(release ? { status: 'available', ...release } : { status: 'unavailable', url: null, source: null, size: null })
    }
    check()
    return () => { cancelled = true }
  }, [open, state.status, online])

  const close = () => {
    setOpen(false)
    setState({ status: 'idle', url: null, source: null, size: null })
  }

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text)
      notify('Build command copied to clipboard.', 'info')
    } catch {
      notify('Clipboard unavailable in this browser — select the command manually.', 'error')
    }
  }

  return (
    <>
      <button className={`btn btn-primary ${className}`} onClick={() => setOpen(true)}>
        <Download size={16} /> Download Android APK
      </button>

      <Modal
        open={open}
        onClose={close}
        title="Install MatatuPulse on Android"
        subtitle="One-tap APK download, or build the exact same static bundle locally with Capacitor."
        width="max-w-xl"
      >
        <AnimatePresence mode="wait">
          {state.status === 'checking' && (
            <motion.div key="checking" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-3 rounded-2xl border border-hairline bg-[var(--chip)] p-5">
              <LoaderCircle size={20} className="animate-spin text-brand-amber" />
              <p className="text-sm text-muted">Checking for a published APK…</p>
            </motion.div>
          )}

          {state.status === 'available' && (
            <motion.div key="available" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
              <div className="glass gradient-edge relative overflow-hidden rounded-2xl p-5">
                <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-brand-amber/20 blur-3xl" />
                <div className="relative flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-violet-600 text-black"><Smartphone size={28} /></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand-amber">Ready to install</p>
                    <h4 className="mt-1 text-lg font-semibold text-ink">MatatuPulse · Android APK</h4>
                    <p className="mt-1 text-[11px] text-muted">{state.source}{state.size ? ` · ${formatSize(state.size)}` : ''}</p>
                  </div>
                </div>
                <a className="btn btn-primary mt-5 w-full" href={state.url} download="matatupulse.apk" onClick={() => notify('APK download started. Enable “Install unknown apps” if Android prompts you.', 'info')}>
                  <Download size={16} /> Download matatupulse.apk
                </a>
                <p className="mt-3 flex items-center gap-1.5 text-center text-[10px] text-muted">
                  <Check size={12} className="text-brand-mint" /> Full offline ledger · Works without Play Store
                </p>
              </div>
              <div className="rounded-xl border border-hairline bg-[var(--chip)] p-3 text-[11px] leading-5 text-muted">
                On your phone, open the downloaded file, choose <strong className="text-ink">Install</strong>, then allow installation from this source once. The app then works fully offline.
              </div>
            </motion.div>
          )}

          {state.status === 'unavailable' && (
            <motion.div key="unavailable" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
              <div className="rounded-2xl border border-brand-amber/35 bg-brand-amber/[0.08] p-4">
                <div className="flex items-start gap-3">
                  {online ? <FileArchive size={19} className="mt-0.5 text-brand-amber" /> : <WifiOff size={19} className="mt-0.5 text-brand-amber" />}
                  <div>
                    <p className="text-[13px] font-semibold text-ink">No published binary found yet</p>
                    <p className="mt-1 text-[11px] leading-5 text-muted">
                      {online
                        ? 'The release pipeline builds a signed-ready debug APK from this exact web build. Run it below or publish a GitHub release to make the one-tap button live.'
                        : 'You are offline, so GitHub releases cannot be checked. The web app and all ledger data still work normally.'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Step number={1} title="Build the Capacitor web bundle and sync Android" command="npm ci && npm run build && npx cap sync android" onCopy={copy} />
                <Step number={2} title="Compile the APK with Gradle" command="cd android && ./gradlew assembleDebug" onCopy={copy} />
                <Step number={3} title="Install on a connected device" command="adb install android/app/build/outputs/apk/debug/app-debug.apk" onCopy={copy} />
              </div>

              <div className="flex flex-wrap gap-2">
                <a className="btn btn-ghost" href={WORKFLOW_URL} target="_blank" rel="noreferrer"><GitBranch size={14} /> Android build workflow <ExternalLink size={12} /></a>
                <a className="btn btn-ghost" href={RELEASES_URL} target="_blank" rel="noreferrer"><Smartphone size={14} /> Published releases <ExternalLink size={12} /></a>
              </div>
              <p className="text-[10px] leading-4 text-muted">Tip: pushing a <code className="text-brand-amber">v*</code> tag runs the same build in GitHub Actions and attaches the APK to that release automatically.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </Modal>
    </>
  )
}
