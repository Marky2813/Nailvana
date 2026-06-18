import nailvanaLogo from '../ui/assets/Nailvana.png'
import { downloadLinks, GITHUB_REPO_URL } from './downloads'
import './landing.css'

function GitHubStarIcon() {
  return (
    <svg
      className="landing-github-star"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 2l2.39 7.26H22l-6.19 4.5 2.36 7.26L12 16.77 5.83 21l2.36-7.26L2 9.26h7.61L12 2z" />
    </svg>
  )
}

export function Landing() {
  return (
    <div className="landing-page">
      <main className="landing-card">
        <div className="landing-brand">
          <img src={nailvanaLogo} alt="" className="landing-logo" />
          <h1 className="landing-title">Nailvana</h1>
        </div>

        <p className="landing-tagline">
          A calm, judgment-free nail-biting companion for your desktop.
        </p>

        <div className="landing-downloads">
          <a className="landing-download-btn" href={downloadLinks.windows} rel="noopener noreferrer">
            Download for Windows
          </a>
          <a className="landing-download-btn" href={downloadLinks.mac} rel="noopener noreferrer">
            Download for macOS
          </a>
          <a className="landing-download-btn" href={downloadLinks.linux} rel="noopener noreferrer">
            Download for Linux
          </a>
        </div>

        <section className="landing-notice" aria-label="Unsigned installer notice">
          <p className="landing-notice-title">Not signed yet</p>
          <p className="landing-notice-copy">
            Nailvana doesn&apos;t have a publisher certificate, so your system may show a security
            warning when you install. That&apos;s expected — the app is open source and runs locally.
            You&apos;ll need to confirm or allow the install yourself.
          </p>
          <ul className="landing-notice-list">
            <li>
              <strong>Windows:</strong> If you see &quot;Windows protected your PC&quot;, click{' '}
              <strong>More info</strong> → <strong>Run anyway</strong>.
            </li>
            <li>
              <strong>macOS:</strong> Right-click the app → <strong>Open</strong> → confirm{' '}
              <strong>Open</strong> on first launch.
            </li>
            <li>
              <strong>Linux:</strong> AppImage may need execute permission after download (
              <code>chmod +x</code>).
            </li>
          </ul>
        </section>

        <a
          className="landing-github-link"
          href={GITHUB_REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          <GitHubStarIcon />
          Star on GitHub
        </a>
      </main>
    </div>
  )
}
