/**
 * Clip Note Selector
 * Highlights specified steps/keys based on pattern input, optionally across channels and clips.
 * @version 0.1
 * @author Xbitz
 */

loadAPI(20)
host.setShouldFailOnDeprecatedUse(true)
host.defineController('Xbitz', 'Clip Note Selector', '0.1', 'b3c83f2a-cc83-4ba2-8d7b-bfa85765a37f', 'Xbitz')

function init () {
  println('-- Clip Note Selector Ready22 --')

  const documentState = host.getDocumentState()
  const cursorClipArranger = host.createArrangerCursorClip(1024, 128)
  const cursorClipLauncher = host.createLauncherCursorClip(1024, 128)

  const clipType = documentState.getEnumSetting('Clip Type', 'Selector', ['Arranger', 'Launcher'], 'Arranger')
//  const channelInput = documentState.getStringSetting('MIDI Channel (0-15)', 'Selector', 2, '1')
  const patternInput = documentState.getStringSetting('Selection Pattern', 'Selector', 100, '1..2,5..7')
  const blockSizeInput = documentState.getStringSetting('Block Size (bars)', 'Selector', 10, '0.5')

  function getClip () {
    return clipType.get() === 'Arranger' ? cursorClipArranger : cursorClipLauncher
  }

  documentState.getSignalSetting('Select Pattern', 'Selector', 'Apply selection').addSignalObserver(() => {
    const clip = getClip()
    const channel = 0
    const pattern = patternInput.get().trim()
    const blockSizeBars = parseFloat(blockSizeInput.get()) || 1
    const stepsPerBlock = Math.floor(blockSizeBars * 16)

    const selectedIndexes = []
    pattern.split(',').forEach(part => {
      const [from, to] = part.split('..').map(s => parseInt(s.trim()))
      if (!isNaN(from)) {
        if (!isNaN(to)) {
          for (let i = from; i <= to; i++) selectedIndexes.push(i - 1)
        } else {
          selectedIndexes.push(from - 1)
        }
      }
    })
    println('Selected relative note indexes: ' + selectedIndexes.join(','))

    // Determine max step
    let maxStep = 0
    for (let step = 0; step < 1024; step++) {
      for (let key = 0; key < 128; key++) {
        const note = clip.getStep(channel, step, key)
        if (note.state().toString() === 'NoteOn') {
          if (step > maxStep) maxStep = step
        }
      }
    }

    const totalBlocks = Math.ceil((maxStep + 1) / stepsPerBlock)
    for (let b = 0; b < totalBlocks; b++) {
      const blockStart = b * stepsPerBlock
      println("block" + b)

      const notes = []
      for (let offset = 0; offset < stepsPerBlock; offset++) {
        const absStep = blockStart + offset
        if (absStep >= 1024) continue

        for (let key = 0; key < 128; key++) {
          const note = clip.getStep(channel, absStep, key)
          if (note.state().toString() === 'NoteOn') {
            notes.push({ key, note })
            println(`Found note at step=${absStep}, key=${key}`)
          }
        }
      }

      notes.sort((a, b) => a.note.x() - b.note.x())

      selectedIndexes.forEach(i => {
        const entry = notes[i]
        if (entry) {
          const { key, note } = entry
          clip.selectStepContents(channel, note.x(), note.y(), false)
          println(`Selected step=${note.x()}, key=${key}, index=${i}`)
        } else {
          println(`Index ${i} out of bounds for notes array with length ${notes.length}`)
        }
      })
    }

    println(`→ Pattern selected on channel ${channel}`)
  })
}

function flush () {}
function exit () {
  println('-- Clip Note Selector Exit --')
}
