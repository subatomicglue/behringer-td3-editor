
let WebAudioAPISound = require( "./WebAudioAPISound" )

let s = new WebAudioAPISound("/assets/Alesis-Fusion-Pizzicato-Strings-C4.wav")
s.load();
function setPattern( p ) {
  console.log( "[stepseq] setPattern", JSON.stringify( p ) )
  pattern = p;
  //s = new WebAudioAPISound("/assets/roland808sd101011.wav")
  //s.load();
}
let pattern;
let bpm = 180;
let start_seq = false;
let interval = false;
let step = 0;
let debug_bpm_msg = 0;

function bpmToMs( bpm, steps_per_beat = 16 ) {
  let steps_per_min = bpm * steps_per_beat;
  let steps_per_sec = steps_per_min * (1 / 60); // step/min * 1min/60sec
  let steps_per_msec = steps_per_sec * (1 / 1000); // step/sec * 1sec/1000ms
  let msec_per_step = 1 / steps_per_msec;
  return msec_per_step
}

function setBpm( b ) {
  bpm = b;
  console.log( `[stepseq] setting bpm to ${bpm}` )
  if (interval) {
    clearInterval( interval );
  }
  interval = setInterval(function() {
    if (start_seq) {
      if (debug_bpm_msg++ % 1000 == 0) console.log( "...sending many clocks... interval timer ms=", bpmToMs( bpm, 2 ))
      //sendNoSync([0xF8]);
      //VERBOSE && console.log( "[stepseq]", step, step % pattern.step_count, pattern.rests[step % pattern.step_count] == 0 )
      let rest = pattern.rests[step % pattern.step_count];
      let pitch = pattern.pitches[step % pattern.step_count];
      if (rest == 0) {
        s.play( { base_pitch: 24, pitch: pitch } );
      }
      ++step;
    }
  }, bpmToMs( bpm, 2 ) );
  return true
}

function getBpm() {
  return bpm;
}

// The TD-3 will only respond to start/stop messages from the source it is synchronizing to.
// That is, if you want to control start/stop from the USB MIDI interface,
// the USB MIDI interface must be sync master, and must also emit clock pulses.
function seqStart() {
  console.log( `[stepseq] starting sequencer` )
  start_seq = true;
  step = 0;
  setBpm( bpm );
  return true
}

function seqStop() {
  if (start_seq) { console.log( "[stepseq] stopping sequencer" ); }
  start_seq = false;
  if (interval) {
    clearInterval( interval );
    interval = undefined;
  }
  return true
}

module.exports = { setPattern, setBpm, getBpm, seqStart, seqStop };

