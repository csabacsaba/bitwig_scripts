/**
 * Clip Note Rewriter
 * Rewrites notes in blocks and assigns MIDI channels based on a user-defined pattern.
 * @version 0.2
 * @author Xbitz
 */

loadAPI(20);
host.setShouldFailOnDeprecatedUse(true);
host.defineController('Xbitz', 'Clip Note Rewriter', '0.2', 'b3c83f3b-cc83-4ba2-8d7b-bfa85765a38f', 'Xbitz');

function init () {
  println('-- Clip Note Rewriter Ready --');

  const documentState = host.getDocumentState();
  const cursorClipArranger = host.createArrangerCursorClip(1024, 128);
  const cursorClipLauncher = host.createLauncherCursorClip(1024, 128);

  const clipType = documentState.getEnumSetting('Clip Type', 'Selector', ['Arranger', 'Launcher'], 'Arranger');
  const blockSizeInput = documentState.getStringSetting('Block Size (bars)', 'Selector', 10, '0.5');
  const patternInput = documentState.getStringSetting('Channel Pattern', 'Rewriter', 32, '1,2,1,2');
  const applySignal = documentState.getSignalSetting('Apply Rewrite', 'Rewriter', 'Rewrite notes by block');

  function getClip () {
    return clipType.get() === 'Arranger' ? cursorClipArranger : cursorClipLauncher;
  }

  function parsePattern(str) {
    return str.split(',').map(s => parseInt(s.trim()) - 1).filter(n => n >= 0 && n < 16);
  }

  function rewriteBlocks() {
    const clip = getClip();
    const blockSizeBars = parseFloat(blockSizeInput.get()) || 1;
    const stepsPerBlock = Math.floor(blockSizeBars * 16);
    const pattern = parsePattern(patternInput.get());

    if (pattern.length === 0) {
      println('Invalid channel pattern.');
      return;
    }

    let allNotes = [];
    let maxStep = 0;

    for (let step = 0; step < 1024; step++) {
      for (let key = 0; key < 128; key++) {
        const note = clip.getStep(0, step, key);
        if (note.state().toString() === 'NoteOn') {
          allNotes.push({ step, key, length: note.duration(), velocity: note.velocity() });
          if (step > maxStep) maxStep = step;
        }
      }
    }

    clip.clearSteps();

    const totalBlocks = Math.ceil((maxStep + 1) / stepsPerBlock);
    for (let b = 0; b < totalBlocks; b++) {
      const blockStart = b * stepsPerBlock;
      const blockEnd = blockStart + stepsPerBlock;
      const blockNotes = allNotes.filter(n => n.step >= blockStart && n.step < blockEnd);

      println("block" + b);

      blockNotes.sort((a, b) => {
        if (a.step === b.step) return a.key - b.key;
        return a.step - b.step;
      });

      blockNotes.forEach((note, i) => {
        const channel = pattern[i % pattern.length];
        println(`Rewritten step=${note.step}, key=${note.key}, channel=${channel}, length=${note.length}, velocity=${note.velocity}`);
        clip.setStep(channel, note.step, note.key, Math.floor(note.velocity * 100), note.length);
      });
    }

    println(`→ Note rewriting completed.`);
  }

  applySignal.addSignalObserver(() => {
    rewriteBlocks();
  });
}

function flush () {}
function exit () {
  println('-- Clip Note Rewriter Exit --');
}
