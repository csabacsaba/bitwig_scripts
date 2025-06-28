/**
 * Clip Note Chopper
 * Chops notes inside the currently selected launcher clip to fixed-length segments, POC
 * @version 0.5
 * @author Xbitz
 */

loadAPI(20)
host.setShouldFailOnDeprecatedUse(true)
host.defineController('Xbitz', 'Clip Note Chopper', '0.1', '2c0cd365-1ec4-4c11-b264-bac8c97db902', 'Xbitz')

function init () {
    println('-- Clip Note Chopper Ready --')

    // Settings shown in Bitwig's controller panel
    const documentState = host.getDocumentState()
    const chopLengthString = documentState.getStringSetting('Chop Length (beats)', 'Note Chopper', 8, '0.25')
    const trigger = documentState.getSignalSetting('Chop Notes', 'Note Chopper', 'Execute')
    const blockLengthString = documentState.getEnumSetting('Block Length (bars)', 'Note Chopper', ['0.25', '0.5', '1'], '1')
    const patternLengthString = documentState.getEnumSetting('Pattern Length (bars)', 'Note Chopper', ['0.25', '0.5', '1', '2', '4', '8'], '4')
    const mutePropagateTrigger = documentState.getSignalSetting('Propagate Mute State', 'Note Chopper', 'Execute')
    const removeMutedNotesTrigger = documentState.getSignalSetting('Remove Muted Notes', 'Note Chopper', 'Execute')

    // Create cursor track and clip
    const cursorTrack = host.createCursorTrack(3, 16)
    const clip = host.createLauncherCursorClip(1024, 128)
    clip.scrollToStep(0)

    // Handler for chopping notes into fixed-length segments
    trigger.addSignalObserver(() => {
        const chopLength = parseFloat(chopLengthString.get())
        if (isNaN(chopLength) || chopLength <= 0) {
            println('Invalid chop length value')
            return
        }
        const stepsPerBeat = 4 // assumes 16th note grid
        const stepsPerChop = chopLength * stepsPerBeat
        const collected = []

        // Collect all NoteOn events from the clip
        for (let step = 0; step < 1024; step++) {
            for (let key = 0; key < 128; key++) {
                const note = clip.getStep(1, step, key)
                if (note.state().toString() === "NoteOn") {
                    collected.push({ step, key, duration: note.duration()})
                }
            }
        }

        println(`Collected ${collected.length} notes for chopping.`)
        if (collected.length === 0) {
            println('No notes found – skipping chopping.')
            return
        }

        // Clear clip before rewriting
        clip.clearSteps()

        // For each note, write chopped segments
        collected.forEach(({ step, key, duration }) => {
            const durationInSteps = duration * stepsPerBeat
            const chopCount = Math.floor(durationInSteps / stepsPerChop)
            for (let i = 0; i < chopCount; i++) {
                const newStep = step + i * stepsPerChop
                clip.setStep(newStep, key, 80, chopLength)
            }
        })

        // Unmute all resulting steps
        for (let step = 0; step < 1024; step++) {
            for (let key = 0; key < 128; key++) {
                const note = clip.getStep(0, step, key)
                note.setIsMuted(false)
            }
        }
        println('→ Chopping complete.')
    })

    // Handler to propagate mute patterns across clip sections
    mutePropagateTrigger.addSignalObserver(() => {
        const stepsPerBeat = 4
        const beatsPerBar = 4
        const blockLength = parseFloat(blockLengthString.get())
        const patternLength = parseFloat(patternLengthString.get())
        if (isNaN(blockLength) || blockLength <= 0 || isNaN(patternLength) || patternLength <= 0) {
            println('Invalid block or pattern value')
            return
        }

        const stepsPerBlock = blockLength * beatsPerBar * stepsPerBeat
        const stepsPerPattern = patternLength * beatsPerBar * stepsPerBeat
        const subPatternCount = Math.floor(stepsPerPattern / stepsPerBlock)
        const subPatterns = []
        const patternKeys = []
        let maxStep = 0

        // Determine the furthest step with content
        for (let step = 0; step < 1024; step++) {
            for (let key = 0; key < 128; key++) {
                const note = clip.getStep(1, step, key)
                if (note.state().toString() === 'NoteOn') {
                    if (step > maxStep) maxStep = step
                }
            }
        }

        // Collect key usage in the first full pattern
        for (let step = 0; step < stepsPerPattern; step++) {
            for (let key = 0; key < 128; key++) {
                const note = clip.getStep(1, step, key)
                if (note.state().toString() === 'NoteOn') {
                    patternKeys.push(key)
                }
            }
        }

        const uniquePatternKeys = Array.from(new Set(patternKeys)).sort((a, b) => a - b)

        // Build mute state maps for each sub-pattern block
        for (let sp = 0; sp < subPatternCount; sp++) {
            const subMap = new Map()
            const stepOffset = sp * stepsPerBlock
            for (let step = 0; step < stepsPerBlock; step++) {
                const absStep = stepOffset + step
                for (let keyIndex = 0; keyIndex < uniquePatternKeys.length; keyIndex++) {
                    const key = uniquePatternKeys[keyIndex]
                    const note = clip.getStep(1, absStep, key)
                    if (note.state().toString() === 'NoteOn') {
                        subMap.set(`${keyIndex}:${step}`, note.isMuted())
                    }
                }
            }
            subPatterns.push(subMap)
        }

        // Apply repeating mute patterns to remaining clip blocks
        const totalBlocks = Math.ceil((maxStep + 1) / stepsPerBlock)
        for (let b = 0; b < totalBlocks; b++) {
            const subIndex = b % subPatternCount
            const subMap = subPatterns[subIndex]
            const stepOffset = b * stepsPerBlock
            const uniqueBlockKeys = []

            // Collect unique keys in block
            for (let key = 0; key < 128; key++) {
                for (let step = stepOffset; step < stepOffset + stepsPerBlock; step++) {
                    const note = clip.getStep(1, step, key)
                    if (note.state().toString() === 'NoteOn') {
                        if (!uniqueBlockKeys.includes(key)) uniqueBlockKeys.push(key)
                    }
                }
            }
            uniqueBlockKeys.sort((a, b) => a - b)

            // Apply sub-pattern mute states
            for (let step = 0; step < stepsPerBlock; step++) {
                const absStep = stepOffset + step
                for (let keyIndex = 0; keyIndex < uniqueBlockKeys.length; keyIndex++) {
                    const key = uniqueBlockKeys[keyIndex]
                    const note = clip.getStep(1, absStep, key)
                    if (note.state().toString() === 'NoteOn') {
                        const muteKey = `${keyIndex}:${step}`
                        if (subMap.has(muteKey)) {
                            note.setIsMuted(subMap.get(muteKey))
                        }
                    }
                }
            }
        }
        println('→ Mute propagation complete.')
    })

    // Handler for removing all muted notes
    removeMutedNotesTrigger.addSignalObserver(() => {
        const retained = []
        for (let step = 0; step < 1024; step++) {
            for (let key = 0; key < 128; key++) {
                const note = clip.getStep(1, step, key)
                if (note.state().toString() === 'NoteOn' && !note.isMuted()) {
                    retained.push({ step, key, duration: note.duration() })
                }
            }
        }
        println(`Retaining ${retained.length} non-muted notes.`)
        clip.clearSteps()
        retained.forEach(({ step, key, duration }) => {
            clip.setStep(step, key, 80, duration)
        })
        println('→ Muted notes removed.')
    })
}

function flush () {}
function exit () {
    println('-- Clip Note Chopper Exit --')
}
