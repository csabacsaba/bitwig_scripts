/**
 * Chord Listen Stop v0.01
 * Immediately stops playback as soon as a Note On event is received, without waiting.
 * @author ChatGPT
 */

loadAPI(20);
host.setShouldFailOnDeprecatedUse(true);
host.defineController('Custom', 'Chord Listen Stop', '0.01', 'aa2aabb0-1abc-4d22-91ff-stopchordlisten', 'ChatGPT');
host.defineMidiPorts(1, 0);

let noteInput = null;
let transport = null;
let isEnabled = true;

function init() {
    println('Chord Listen Stop script initialized');

    transport = host.createTransport();

    // MIDI input setup
    noteInput = host.getMidiInPort(0).createNoteInput('ChordListenInput');
    noteInput.setShouldConsumeEvents(false);

    // Listen to raw MIDI
    host.getMidiInPort(0).setMidiCallback(onMidi);

    // Add toggle switch to UI
    const documentState = host.getDocumentState();
    const toggleSetting = documentState.getBooleanSetting('Stop On Note', 'Chord Listen Stop', true);

    toggleSetting.addValueObserver(function(value) {
        isEnabled = value;
        println('Chord Listen Stop enabled: ' + value);
    });
}

function onMidi(status, data1, data2) {
    const type = status & 0xF0;

    // Note On with velocity > 0
    if (isEnabled && type === 0x90 && data2 > 0) {
        println('Note On: ' + data1 + ' – stopping transport immediately.');
        transport.stop();
    }
}

function flush() {}

function exit() {
    println('Chord Listen Stop script exited');
}
