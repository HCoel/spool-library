// Hand a file to the iOS share sheet, or download it where sharing files is unsupported.
// Returns 'shared' | 'cancelled' | 'blocked' | 'downloaded'. Only 'shared' and 'downloaded' mean a file left the app.
export async function deliverFile(file, { nav = navigator, download }) {
  if (nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: 'Spool Library backup' })
      return 'shared'
    } catch (e) {
      if (e.name === 'AbortError') return 'cancelled'
      // Safari needs a fresh tap if too much time passed since the original one
      if (e.name === 'NotAllowedError') return 'blocked'
    }
  }
  download(file)
  return 'downloaded'
}
