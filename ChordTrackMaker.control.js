/**
 * Chord Track Maker
 * Controller script for Bitwig Studio
 * Generates muted chord notes across octaves based on user-defined chords and lengths
 * @version 0.1
 * @author Xbitz
 */

loadAPI(20)
host.setShouldFailOnDeprecatedUse(true)
host.defineController('Xbitz', 'Chord Track Maker', '0.1', 'b3c83f2a-cc83-4ba2-8d7b-bfa85765a37e', 'Xbitz')

const CHORDS = {
  "A": [57, 61, 64], "Amin": [57, 60, 64], "Asus2": [57, 59, 64], "Asus4": [57, 62, 64], "Aaug": [57, 61, 65], "Adim": [57, 60, 63], "A7": [57, 61, 64, 67],
  "B": [59, 63, 66], "Bmin": [59, 62, 66], "Bsus2": [59, 61, 66], "Bsus4": [59, 64, 66], "Baug": [59, 63, 67], "Bdim": [59, 62, 65], "B7": [59, 63, 66, 69],
  "C": [48, 52, 55], "Cmin": [48, 51, 55], "Csus2": [48, 50, 55], "Csus4": [48, 53, 55], "Caug": [48, 52, 56], "Cdim": [48, 51, 54], "C7": [48, 52, 55, 58],
  "D": [50, 54, 57], "Dmin": [50, 53, 57], "Dsus2": [50, 52, 57], "Dsus4": [50, 55, 57], "Daug": [50, 54, 58], "Ddim": [50, 53, 56], "D7": [50, 54, 57, 60],
  "E": [52, 56, 59], "Emin": [52, 55, 59], "Esus2": [52, 54, 59], "Esus4": [52, 57, 59], "Eaug": [52, 56, 60], "Edim": [52, 55, 58], "E7": [52, 56, 59, 62],
  "F": [53, 57, 60], "Fmin": [53, 56, 60], "Fsus2": [53, 55, 60], "Fsus4": [53, 58, 60], "Faug": [53, 57, 61], "Fdim": [53, 56, 59], "F7": [53, 57, 60, 63],
  "G": [55, 59, 62], "Gmin": [55, 58, 62], "Gsus2": [55, 57, 62], "Gsus4": [55, 60, 62], "Gaug": [55, 59, 63], "Gdim": [55, 58, 61], "G7": [55, 59, 62, 65]
}

const OCTAVES = [12, 24, 36, 48, 60, 72, 84, 96] // from C1 to C8

function init () {
  println('-- Chord Track Maker Ready2 --')

  const documentState = host.getDocumentState()
  const cursorClipArranger = host.createArrangerCursorClip((16 * 64), 128)
  const cursorClipLauncher = host.createLauncherCursorClip((16 * 64), 128)
  cursorClipArranger.scrollToKey(0)
  cursorClipLauncher.scrollToKey(0)

  const clipType = documentState.getEnumSetting('Clip Type', 'Chord Track Maker', ['Arranger', 'Launcher'], 'Arranger')
  const chordInput = documentState.getStringSetting('Chords', 'Chord Track Maker', 100, 'Amin, Asus4, F, Dmin')
  const lengthInput = documentState.getStringSetting('Lengths', 'Chord Track Maker', 100, '1,1,1,1')

  function getCursorClip () {
    return clipType.get() === 'Arranger' ? cursorClipArranger : cursorClipLauncher
  }

  documentState.getSignalSetting('Generate', 'Chord Track Maker', 'Generate').addSignalObserver(() => {
    let clip = getCursorClip()
    clip.clearSteps()
    clip.scrollToStep(0)

    const chords = chordInput.get().split(',').map(s => s.trim()).filter(Boolean)
    const lengths = lengthInput.get().split(',').map(s => parseFloat(s.trim()) || 1.0)

    let position = 0
    chords.forEach((name, idx) => {
      const len = (lengths[idx] || 1.0) * 16 // convert to steps per bar
      const chord = CHORDS[name] || []

      OCTAVES.forEach(oct => {
        chord.forEach(note => {
          const pitch = note + (oct - 60)
          if (pitch >= 0 && pitch <= 127) {
            clip.setStep(position, pitch, 0, len / 4)
            let step = clip.getStep(1, position, pitch)
            step.setIsMuted(true)
            step.setDuration(len / 4)
          }
        })
      })
      position += len
    })
    clip.scrollToStep(position)
  })

  documentState.getSignalSetting('Clear', 'Chord Track Maker', 'Clear').addSignalObserver(() => {
    getCursorClip().clearSteps()
  })

  documentState.getSignalSetting('Stacked', 'Chord Track Maker', 'Stacked (Normalize)').addSignalObserver(() => {
    let clip = getCursorClip()
    clip.clearSteps()
    clip.scrollToStep(0)

    const chords = chordInput.get().split(',').map(s => s.trim()).filter(Boolean)
    const lengths = lengthInput.get().split(',').map(s => parseFloat(s.trim()) || 1.0)

    let position = 0
    chords.forEach((name, idx) => {
      const len = (lengths[idx] || 1.0) * 16
      const raw = CHORDS[name] || []
      if (raw.length === 0) return

      const sorted = raw.slice().sort((a, b) => a - b)
      const base = 60 // C4

      let bass = sorted[0] - 12
      let mid = sorted[1]
      let top = sorted[2]
      if (sorted.length > 3) top = sorted[3] // 4-note chords fallback

      const pitches = [bass, mid, top].filter(p => p >= 0 && p <= 127)
      pitches.forEach(pitch => {
        clip.setStep(position, pitch, 0, len / 4)
        let step = clip.getStep(1, position, pitch)
        step.setIsMuted(false)
        step.setDuration(len / 4)
      })
      position += len
    })
    clip.scrollToStep(position)
  })
}

function flush () {}
function exit () {
  println('-- Chord Track Maker Exit --')
}
