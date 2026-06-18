export const GITHUB_REPO_URL = 'https://github.com/Marky2813/Nailvana'
export const RELEASES_LATEST_URL = `${GITHUB_REPO_URL}/releases/latest`

/**
 * After your first `bun run dist:*` release, replace these with the real asset
 * filenames from GitHub Releases (e.g. Nailvana-Setup-1.0.0.exe).
 * Until then, all buttons fall back to the latest releases page.
 */
const RELEASE_VERSION = '1.0.0'

const WINDOWS_INSTALLER = `Nailvana-Setup-${RELEASE_VERSION}.exe`
const MAC_INSTALLER = `Nailvana-${RELEASE_VERSION}.dmg`
const LINUX_INSTALLER = `Nailvana-${RELEASE_VERSION}.AppImage`

const USE_DIRECT_DOWNLOADS = false

function latestAssetUrl(filename: string) {
  return `${RELEASES_LATEST_URL}/download/${filename}`
}

export const downloadLinks = {
  windows: USE_DIRECT_DOWNLOADS ? latestAssetUrl(WINDOWS_INSTALLER) : RELEASES_LATEST_URL,
  mac: USE_DIRECT_DOWNLOADS ? latestAssetUrl(MAC_INSTALLER) : RELEASES_LATEST_URL,
  linux: USE_DIRECT_DOWNLOADS ? latestAssetUrl(LINUX_INSTALLER) : RELEASES_LATEST_URL,
}
