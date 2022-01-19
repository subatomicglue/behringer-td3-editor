// in nodejs, there is no import/export, so pull in 'esm' to define those...
// import me like this:
//   require = require('esm')( module )
//   let td3 = require('./td3');
//

let VERBOSE = false;
let VERBOSE_PROMISE_FLOW = false;
function setVerbose( v ) { VERBOSE = v; }

// flatten an array e.g. [ [2,3], [1,0] ] to [2,3,1,0]
function flattenArray( arr ) {
  return [].concat(...arr)
}

// convert a single number 0x1, or an array of numbers [0x1,0xf], to a string for printing "0x1" or "0x1, 0xf".
function hex2hexstr( hex ) {
  if (Array.isArray( hex )) {
    return hex.map( r => hex2hexstr( r ) ).join( ", " )
  } else {
    return hex != undefined ? "0x" + hex.toString( 16 ).padStart( 2, '0' ) : "undf"
  }
}
// convert a single number 0x1, or an array of numbers [0x1,0xf], to a string for printing "1" or "1, 15".
function hex2numstr( hex ) {
  if (Array.isArray( hex )) {
    return hex.map( r => hex2numstr( r ) ).join( ", " )
  } else {
    return hex.toString( 10 )
  }
}
// convert a single number 0x41 (65) to string "A"
function hex2str( hex, stop_at_null=false ) {
  if (Array.isArray( hex )) {
    if (stop_at_null) {
      let null_pos = hex.lastIndexOf( 0x0 );
      if (0 <= null_pos)
        hex = hex.slice( 0, null_pos )
    }
    return hex.map( r => hex2str( r, stop_at_null ) ).join( "" )
  } else {
    return 32 <= hex && hex <= 126 ? String.fromCharCode( hex ) : "*"
  }
}
// convert a null terminated byte array [0x44, 0x2d, 0x33, 0x00] to string "TD-3"
function hex2str_nullterm( hex ) {
  return hex2str( hex, true );
}

// convert a hex number in a string "0xff" to a number 255 (same as 0xff)
function hexstr2number( hex ) {
  return parseInt( hexString, 16 );
}

// add the sysex wrapper
function sysex( bytes ) {
  return [0xF0, ...bytes, 0xF7]
}
// remove the sysex wrapper
function sysex_unpack( bytes ) {
  return bytes.slice( 1, bytes.length - 1 )
}

// add the sysex wrapper AND td3 header
function sysex_td3( bytes ) {
  return sysex( [0x00, 0x20, 0x32, 0x00, 0x01, 0x0A, ...bytes] )
}
// remove the sysex wrapper AND td3 header
function sysex_td3_unpack( bytes ) {
  return sysex_unpack( bytes ).slice( 6, bytes.length-1 )
}
function isSysex( bytes ) {
  return 2 <= bytes.length && bytes[0] == 0xf0 && bytes[bytes.length-1] == 0xf7;
}
function isSysexTD3( bytes ) {
  if (isSysex( bytes )) {
    return 8 <= bytes.length &&
      bytes[1] == 0x00 &&
      bytes[2] == 0x20 &&
      bytes[3] == 0x32 &&
      bytes[4] == 0x00 &&
      bytes[5] == 0x01 &&
      bytes[6] == 0x0A;
  }
  return false;
}

// 8-bit values spread over two bytes are very common. It is suspected that
// this is how Behringer avoids having to deal with 7-bit values. (The most
// significant bit can't normally be used in MIDI messages, as it indicates
// a System Realtime message.) Rather than limiting to 7 bits, it seems that
// 8-bit values are just split into their upper 4 bits in the first byte,
// and lower 4 bits in the next byte. For example, consider this sequence:
function td3_split_byte( b ) {
  if (Array.isArray( b )) {
    return flattenArray( b.map( r => td3_split_byte( r ) ) );
  } else {
    return [ (b & 0xf0) >> 4, (b & 0x0f) ];
  }
}
function td3_combine_4bit( b1, b2 ) {
  if (Array.isArray( b1 ) && b1.length%2 == 0) {
    let pairs = [];
    for (let x = 0; x < b1.length; x+=2) { pairs.push( [b1[x], b1[x+1]] ) }
    return pairs.map( r => td3_combine_4bit( r[0], r[1] ) )
  } else {
    return ((b1 & 0x0F) << 4) | (b2 & 0x0F);
  }
}
function td3_combine_7bit( b1, b2 ) {
  if (Array.isArray( b1 ) && b1.length%2 == 0) {
    let pairs = [];
    for (let x = 0; x < b1.length; x+=2) { pairs.push( [b1[x], b1[x+1]] ) }
    return pairs.map( r => td3_combine_7bit( r[0], r[1] ) )
  } else {
    return ((b1 & 0x007F) << 7) | (b2 & 0x007F);
  }
}

const MessageTypes = {
  // messages you can send
  GET_MODEL_CODE: 0x04,
  GET_PRODUCT_NAME: 0x06,
  GET_FIRMWARE_VERSION: 0x08,
  GET_PATTERN: 0x77,
  GET_CONFIGURATION: 0x75,

  SET_PATTERN: 0x78,
  SET_MIDI: 0x0E,
  SET_KEYPRIORITY: 0x12,
  SET_PITCH_BEND_SEMITONES: 0x11,
  SET_MULTI_TRIGGER_MODE: 0x14,
  SET_ACCENT_VEL_THRESHOLD: 0x1C,
  SET_MIDI_INPUT_TRANSPOSE: 0x0F,
  SET_CLOCK_SRC: 0x1B,
  SET_CLOCK_TRIGGER_RATE: 0x1A,
  SET_CLOCK_TRIGGER_POLARITY: 0x19,
  RESET_CONFIGURATION: 0x7D,
  SET_TEST_MODE: 0x50,
  USB_MIDI_LOOPBACK: 0x7E,

  // messages the td3 sends back to us
  ACK: 0x1,
  MODEL_CODE: 0x5,
  PRODUCT_NAME:0x7,
  FIRMWARE_VERSION: 0x9,
  CONFIGURATION: 0x76,
  PATTERN: 0x78,
  USB_MIDI_LOOPBACK_REPONSE: 0x7E,
  TESTMODE_TEMPO_KNOB: 0xA0,
  TESTMODE_TRACKPATTERN_GROUP_KNOB: 0xA1,
  TESTMODE_MODE_KNOB: 0xA2,
  TESTMODE_UNKNOWN: 0xA3,
  TESTMODE_BUTTONS: 0xA4,

  // general
  MIDI_NOTE_ON: 0x90,
  MIDI_NOTE_OFF: 0x80,
  MIDI_CONTROL_CHANGE: 0xB0,
  MIDI_SEQ_START: 0xFA,    // sent from td3 when start/stop button is pressed
  MIDI_SEQ_CONTINUE: 0xFB, // send this to td3 to start it
  MIDI_SEQ_STOP: 0xFC,
  MIDI_SEQ_CLOCK: 0xF8,
  MIDI_RESET: 0xFF, // midi spec
  MIDI_SONG_POS: 0xF2, // midi spec
}
function getMessageTypeStr( code ) {
  let result = Object.keys( MessageTypes ).find( r => MessageTypes[r] == code );
  return result ? result : `undefined (${code} ${hex2hexstr( code )})`
}

// subtype of MessageTypes.TESTMODE_BUTTONS
const TestModeButtonTypes = {
  CLEAR: 0x00,
  STARTSTOP: 0x01,
  PITCHMODE: 0x02,
  BAR: 0x03,
  NOTE_0: 0x04,
  NOTE_1: 0x05,
  NOTE_2: 0x06,
  NOTE_3: 0x07,
  NOTE_4: 0x08,
  NOTE_5: 0x09,
  NOTE_6: 0x0a,
  NOTE_7: 0x0b,
  NOTE_8: 0x0c,
  NOTE_9: 0x0d,
  NOTE_10: 0x0e,
  NOTE_11: 0x0f,
  NOTE_12: 0x10,
  STEP: 0x11,
  TRIPLET: 0x12,
  PATTERNA: 0x13,
  SLIDE: 0x14,
  PATTERNB: 0x15,
  BACK: 0x16,
  WRITENEXT: 0x17,
}
function getTestModeButtonTypesStr( code ) {
  let result = Object.keys( TestModeButtonTypes ).find( r => TestModeButtonTypes[r] == code )
  return result ? result : `undefined (${code} ${hex2hexstr( code )})`
}

// subtype of MessageTypes.MIDI_CONTROL_CHANGE
const MIDIControlChange = {
  ALL_NOTES_OFF: 123,
}
function getMIDIControlChangeStr( code ) {
  let result = Object.keys( MIDIControlChange ).find( r => MIDIControlChange[r] == code );
  return result ? result : `undefined (${code} ${hex2hexstr( code )})`
}

// MessageBuilders
const Send = {
  GET_MODEL_CODE: () => sysex_td3( [0x04] ),              // returns bytes 7   (0x05),     8-N (null terminated string)
  GET_PRODUCT_NAME: () => sysex_td3( [0x06] ),            // returns bytes 7   (0x07),     8-N (null terminated string)
  GET_FIRMWARE_VERSION: () => sysex_td3( [0x08, 0x00] ),  // returns bytes 7,8 (0x09 0x00),9,10,11 (major, minor, rev)
  GET_PATTERN: (group, section) => sysex_td3( [0x77, group, section] ), // group 0x0-3, section 0xA/B
                                                                        // returns
                                                                        /*
                                                                        0x07:        Pattern Command (0x78)
                                                                        0x08:        Pattern Group (0x0-3)
                                                                        0x09:        Pattern Section/Pattern (0xA/B: A=1-8, B=9-16)
                                                                        0x0A - 0x0B: ???          Always observed as 0x0000
                                                                        0x0C - 0x2B: Pitches      2 bytes each, 16 steps total
                                                                        0x2C - 0x4B: Accent       2 bytes each, 16 steps total
                                                                        0x4C - 0x6B: Slide        2 bytes each, 16 steps total
                                                                        0x6C - 0x6D: Triplet Mode 2 bytes, 0 or 1)
                                                                        0x6E - 0x6F: Step Count   2 bytes, 1-16)
                                                                        0x70 - 0x71: ???          Always observed as 0x0000
                                                                        0x72 - 0x75: Tie          See Rest for format.
                                                                        0x76 - 0x79: Rest
                                                                          Bitmask, with only least significant nibble used.  Layout is like this:
                                                                            xxxx7654 xxxx3210 xxxxFEDC xxxxBA98
                                                                        */
  GET_CONFIGURATION: () => sysex_td3( [0x75] ),     // returns
                                                    /*
                                                    0x07: Config Command (0x76)
                                                    0x08: MIDI Out Channel [0x00-0x0F]
                                                    0x09: MIDI In Channel [0x00-0x0F]
                                                    0x0A: MIDI Transpose [-12 <0x00> to 0 <0x0C> to +12 <0x18>]
                                                    0x0B: Pitch Bend Semitones (0-12)
                                                    0x0C: Key Priority <enum>
                                                      0x00 - Low
                                                      0x01 - High
                                                      0x02 - Last
                                                    0x0D: Multi-Trigger Mode <bool>
                                                    0x0E: Clock Trigger Polarity <enum>
                                                      0x00 - Fall
                                                      0x01 - Rise
                                                    0x0F: Clock Trigger Rate <enum>
                                                      0x00 - 1 PPS
                                                      0x01 - 2 PPQ
                                                      0x02 - 24 PPQ
                                                      0x08 - 48 PPQ
                                                    0x10: Clock Source <enum>
                                                      0x00 - Internal
                                                      0x01 - MIDI DIN
                                                      0x02 - MIDI USB
                                                      0x03 - Trigger
                                                    0x11: Accent Velocity Threshold (0 to 127)
                                                    */
  SET_MIDI: (midiout_ch, midiin_ch) => sysex_td3( [0x0E, midiout_ch, 0x0, midiin_ch] ), // midi channels are 0x00-0x0F
  SET_KEYPRIORITY: (priority) => sysex_td3( [0x12, priority & 0x3] ),                   // enum 0x00 - Low, 0x01 - High, 0x02 - Last
  SET_PITCH_BEND_SEMITONES: (semitones) => sysex_td3( [0x11, semitones] ),              // int  0-12
  SET_MULTI_TRIGGER_MODE: (enable) => sysex_td3( [0x14, enable] ),                      // bool 0-1
  SET_ACCENT_VEL_THRESHOLD: (vel) => sysex_td3( [0x1C, vel] ),                          // int  0 to 127
  SET_MIDI_INPUT_TRANSPOSE: (semitones) => sysex_td3( [0x0F, semitones] ),              // (semitones) -12 (0x00) to +12 (0x18)
  SET_CLOCK_SRC: (src) => sysex_td3( [0x1B, src] ),                                     // enum 0x00 - Internal, 0x01 - MIDI DIN, 0x02 - MIDI USB, 0x03 - Trigger
  SET_CLOCK_TRIGGER_RATE: (e) => sysex_td3( [0x1A, e] ),                                // enum 0x00 - 1 PPS, 0x01 - 2 PPQ, 0x02 - 24 PPQ, 0x08 - 48 PPQ (only valid when clock src is TRIGGER)
  SET_CLOCK_TRIGGER_POLARITY: (e) => sysex_td3( [0x19, e] ),                            // enum 0x00 - Fall, 0x01 - Rise (only valid when clock src is TRIGGER)
  RESET_CONFIGURATION: () => sysex_td3( [0x7D] ),                                       // Resets all the configuration of the TD-3 to factory defaults. (Leaves patterns intact.)
  SET_TEST_MODE: (enable=true) => sysex_td3( [0x50, enable] ),                          // 0-1, Sets the TD-3 into a panel test mode where all buttons and the tempo, track, and mode knobs send MIDI data to verify their operation.
  USB_MIDI_LOOPBACK: () => sysex_td3( [0x7E] ),                                         // Enables echoing back MIDI messages from input to output.
  SET_PATTERN: (pattern) => packPattern( pattern ),                                     // send a pattern
}

const ResponseMap = {
  [MessageTypes.GET_MODEL_CODE]: MessageTypes.MODEL_CODE,
  [MessageTypes.GET_PRODUCT_NAME]: MessageTypes.PRODUCT_NAME,
  [MessageTypes.GET_FIRMWARE_VERSION]: MessageTypes.FIRMWARE_VERSION,
  [MessageTypes.GET_PATTERN]: MessageTypes.PATTERN,
  [MessageTypes.GET_CONFIGURATION]: MessageTypes.CONFIGURATION,

  //[MessageTypes.SET_PATTERN]: MessageTypes.PATTERN,
  [MessageTypes.SET_MIDI]: MessageTypes.ACK,
  [MessageTypes.SET_KEYPRIORITY]: MessageTypes.ACK,
  [MessageTypes.SET_PITCH_BEND_SEMITONES]: MessageTypes.ACK,
  [MessageTypes.SET_MULTI_TRIGGER_MODE]: MessageTypes.ACK,
  [MessageTypes.SET_ACCENT_VEL_THRESHOLD]: MessageTypes.ACK,
  [MessageTypes.SET_MIDI_INPUT_TRANSPOSE]: MessageTypes.ACK,
  [MessageTypes.SET_CLOCK_SRC]: MessageTypes.ACK,
  [MessageTypes.SET_CLOCK_TRIGGER_RATE]: MessageTypes.ACK,
  [MessageTypes.SET_CLOCK_TRIGGER_POLARITY]: MessageTypes.ACK,

  //[MessageTypes.RESET_CONFIGURATION]: MessageTypes.ACK, // There is no response for this message.
  //[MessageTypes.SET_TEST_MODE]: MessageTypes.ACK, // There is no response for this message (only once buttons are pressed)
  [MessageTypes.USB_MIDI_LOOPBACK]: MessageTypes.USB_MIDI_LOOPBACK_REPONSE,
}
// map of ResponseMap value to array of promise resolve funcs...
let pending_request_promises = {}
function onCodeRequest( code, rs ) {
  VERBOSE_PROMISE_FLOW && console.log( "[td3] onCodeRequest", hex2hexstr( code ), "->", ResponseMap.hasOwnProperty(code) ? hex2hexstr( ResponseMap[code] ) : "??", pending_request_promises )
  if (ResponseMap.hasOwnProperty(code)) {
    if (pending_request_promises[ResponseMap[code]] == undefined)
      pending_request_promises[ResponseMap[code]] = []
    pending_request_promises[ResponseMap[code]].push( rs );
  } else {
    rs();
  }
}
function onCodeReceived( code, value ) {
  VERBOSE_PROMISE_FLOW && console.log( "[td3] onCodeReceived", hex2hexstr( code ), value, pending_request_promises )
  if (pending_request_promises.hasOwnProperty(code)) {
    let resolve_funcs = pending_request_promises[code];
    for (let rs of resolve_funcs) {
      rs(value);
    }
    delete pending_request_promises[code]
  }
}

// give a byte array[4] [xxxx7654, xxxx3210, xxxxFEDC, xxxxBA98], bits marked 0-F in the lower nibbles represent the packed boolean array[16]
// return  0/1 array[16] [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0]
function unpackTiesRests( a ) {
  return [
    a[1] & 0x1, a[1]>>1 & 0x1, a[1]>>2 & 0x1, a[1]>>3 & 0x1,
    a[0] & 0x1, a[0]>>1 & 0x1, a[0]>>2 & 0x1, a[0]>>3 & 0x1,
    a[3] & 0x1, a[3]>>1 & 0x1, a[3]>>2 & 0x1, a[3]>>3 & 0x1,
    a[2] & 0x1, a[2]>>1 & 0x1, a[2]>>2 & 0x1, a[2]>>3 & 0x1,
  ];
}

// give a    0/1 array[16] [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0]
// return a byte array[4] [xxxx7654, xxxx3210, xxxxFEDC, xxxxBA98], bits marked 0-F in the lower nibbles represent the packed boolean array[16]
function packTiesRests( a ) {
  return [
     (a[7] << 3) |  (a[6] << 2) |  (a[5] << 1) |  a[4],
     (a[3] << 3) |  (a[2] << 2) |  (a[1] << 1) |  a[0],
    (a[15] << 3) | (a[14] << 2) | (a[13] << 1) | a[12],
    (a[11] << 3) | (a[10] << 2) |  (a[9] << 1) |  a[8],
  ]
}

function copyArray( dst, dst_start, dst_end, src, src_start = 0 ) {
  if ((src.length - src_start) < (dst_end - dst_start) || dst.length <= dst_end) {
    console.log( `[td3] error:  not enough array elements in source (len: ${src.length} start: ${src_start}), to copy over to dest (len: ${dst.length} start: ${dst_start} end: ${dst_end})` );
    process.exit( -1 );
  }
  for (let x = 0; x <= (dst_end - dst_start); ++x) {
    dst[dst_start + x] = src[src_start + x];
  }
}

function isArraysEqual( ary1, ary2 ) {
  if (ary1.length != ary2.length ) return false;
  for (let x = 0; x < ary1.length; ++x) {
    if (ary1[x] != ary2[x]) return false;
  }
  return true;
}

// move the front-of-array-packed data (pitches/slides/accents) to the array slots they play in (see unpackPattern() for commentary)
function unpackArrayByRests( data, rests, off ) {
  if (data.length != rests.length) return undefined; // assumption

  let new_data = new Array(data.length);
  let idx = 0; // advances fwd by 1 for each '0' rest...
  for (let x = 0; x < data.length; ++x) {
    if (rests[x] == 0) {
      new_data[x] = data[idx]
      ++idx;
    } else {
      new_data[x] = off; // off
    }
  }
  return new_data;
}

// re-pack the rest=0 (active note) pitches to the front-of-array (see unpackPattern() for commentary)
function packArrayByRests( pitches, rests, off ) {
  if (pitches.length != rests.length) return undefined; // assumption

  let new_pitches = new Array(16)
  let cur_pitch = 0;
  for (let x = 0; x < 16; ++x) {
    if (rests[x] == 0) {
      new_pitches[cur_pitch] = pitches[x];
      ++cur_pitch;
    }
  }
  return new_pitches.fill( off, cur_pitch, new_pitches.length );
}

function unpackPattern( msg ) {
  //let cmd = msg[0x7]; // always 0x78
  let group = msg[0x8];
  let section = msg[0x9];
  let unknown_zeros = td3_combine_4bit( msg.slice( 0x0A, 0x0B+1 ) )[0]; // unknown what these are for
  let pitches = td3_combine_4bit( msg.slice( 0x0C, 0x2B+1 ) );
  let accents = td3_combine_4bit( msg.slice( 0x2C, 0x4B+1 ) );
  let slides = td3_combine_4bit( msg.slice( 0x4C, 0x6B+1 ) );
  let triplet_mode = td3_combine_4bit( msg.slice( 0x6C, 0x6D+1 ) )[0];
  let step_count = td3_combine_4bit( msg.slice( 0x6E, 0x6F+1 ) )[0];
  let unknown_zeros2 = td3_combine_4bit( msg.slice( 0x70, 0x71+1 ) )[0]; // unknown what these are for
  let ties = unpackTiesRests( msg.slice( 0x72, 0x75+1 ) )
  let rests = unpackTiesRests( msg.slice( 0x76, 0x79+1 ) )

  // ok.  great.
  // you would think that 16 pitches correspond to 16 rests, and if you turn off a rest then the machine simply skips that pitch.  NOPE.
  // f**king tb-303 and it's user "interface"...
  // figures
  // well, that's why i'm writing this in the first place.
  // the stupid tb-303 "user interface" atrocity of entering in pitches/accents/rests separately from each other, who thinks like that?
  // yes, it lends itself to serendipitous random patterns you wouldn't normally get...
  // ...but to actually enter anything deliberately is exceedingly HARD.
  // ...nevermind editing.
  // anyway
  // i digress.
  // Each rest '1' turns off a note, so that each rest '0' plays a note
  // Each rest '0' grabs the "next" pitch, NOT the pitch from the corresponding slot (wtf, i know right?)
  // So that rests 0,1,0,1  only plays the first 2 pitches in 24, 32, 34, 42
  // Two thoughts:
  // 1.) who creates an array to NOT play a note, that's backwards  (an array of rests?  did some music school intern write this?)
  // 2.) who creates all these 1:1 arrays, where each slot is 1 step, BUT THEN pitches are NOT 1:1 with steps, they're 1:1 with turned-off-rests!?!
  // yeah.  that's what it (f**king) does.
  // There isNOT a 1:1 between the rest and pitch slots. (?!?!)
  // There is 1:1 between every.. other.. slot!!  just not pitch.  it's special.   for some reason.
  // so we're going to unpack the pitches to be 1:1 with the corresponding slots so we can rationalize/edit about them, at all, in the editor.
  // user ergonomics people.  sheesh.

  // move the front-of-array-packed pitches to the array slots they play in
  pitches = unpackArrayByRests( pitches, rests, 0x18 );
  slides = unpackArrayByRests( slides, rests, 0 );
  accents = unpackArrayByRests( accents, rests, 0 );
  return { group, section, pitches, accents, slides, triplet_mode, step_count, ties, rests };
}

function packPattern( pattern ) {
  // re-pack the rest=0 (active note) pitches/slides/accents to the front of array (see unpackPattern() for commentary)
  let pitches = packArrayByRests( pattern.pitches, pattern.rests, 0x18 );
  let slides = packArrayByRests( pattern.slides, pattern.rests, 0 );
  let accents = packArrayByRests( pattern.accents, pattern.rests, 0 );

  let msg = sysex_td3( new Array( (0x79-0x7) + 1 ).fill(0) )
  msg[0x7] = 0x78; // always 0x78
  msg[0x8] = pattern.group;
  msg[0x9] = pattern.section;
  copyArray( msg, 0x0A, 0x0B, td3_split_byte( 0 ) );
  copyArray( msg, 0x0C, 0x2B, td3_split_byte( pitches ) );
  copyArray( msg, 0x2C, 0x4B, td3_split_byte( accents ) );
  copyArray( msg, 0x4C, 0x6B, td3_split_byte( slides  ) );
  copyArray( msg, 0x6C, 0x6D, td3_split_byte( pattern.triplet_mode ) );
  copyArray( msg, 0x6E, 0x6F, td3_split_byte( pattern.step_count ) );
  copyArray( msg, 0x70, 0x71, td3_split_byte( 0 ) );
  copyArray( msg, 0x72, 0x75, packTiesRests( pattern.ties ) );
  copyArray( msg, 0x76, 0x79, packTiesRests( pattern.rests ) );
  return msg;
}

function unpackConfiguration( msg ) {
  return {
    //cmd: msg[0x07],
    midi_out_channel: msg[0x08],       // int  0-15
    midi_in_channel: msg[0x09],        // int  0-15
    midi_transpose: msg[0x0A],         // int  [-12 <0x00> to 0 <0x0C> to +12 <0x18>]
    pitch_bend_semitones: msg[0x0B],   // int  0-12
    key_priority: msg[0x0C],           // enum 0x00 - Low, 0x01 - High, 0x02 - Last
    multi_trigger_mode: msg[0x0D],     // bool 0-1
    clock_trigger_polarity: msg[0x0E], // enum 0x00 - Fall, 0x01 - Rise
    clock_trigger_rate: msg[0x0F],     // enum 0x00 - 1 PPS, 0x01 - 2 PPQ, 0x02 - 24 PPQ, 0x08 - 48 PPQ
    clock_src: msg[0x10],              // enum 0x00 - Internal, 0x01 - MIDI DIN, 0x02 - MIDI USB, 0x03 - Trigger
    accent_vel_threshold: msg[0x11],   // int  0 to 127
  }
}

///////////////////////////////////// TESTS ////////////////////////////////////////////////////////////////////////////
// example pattern message (tests the pitch packing with 0/1 rests)
let test_pattern = {
  group: 0,
  section: 1,
  pitches: [ 36, 35, 36, 35, 36, 35, 36, 35, 36, 35, 36, 35, 36, 35, 36, 35 ],
  accents: [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ],
  slides: [ 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1 ],
  triplet_mode: 0,
  step_count: 16,
  ties: [ 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1 ],
  rests: [ 0, 1, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0, 1 ],
};
let test_pattern_msg  = packPattern( test_pattern );
let test_pattern2     = unpackPattern( test_pattern_msg );
let test_pattern_msg2 = packPattern( test_pattern2 );
if (!isArraysEqual( test_pattern_msg, test_pattern_msg2 )) {
  console.log( "[td3] something wrong with the pattern serialize/deserialize" );
  console.log( "[td3] test_pattern_msg ", hex2hexstr( test_pattern_msg ) );
  console.log( "[td3] init_pattern", test_pattern );
  console.log( "[td3] test_pattern_msg2", hex2hexstr( test_pattern_msg2 ) );
  console.log( "[td3] isArraysEqual", isArraysEqual( test_pattern_msg, test_pattern_msg2 ) );
  process.exit(-1)
}

// example pattern message (example message pulled from td3)
let init_pattern_msg = [0xF0, 0x00, 0x20, 0x32, 0x00, 0x01, 0x0A, 0x78, 0x00, 0x01, 0x00, 0x00, 0x02, 0x04, 0x02, 0x03,
0x02, 0x04, 0x02, 0x03, 0x02, 0x04, 0x02, 0x03, 0x02, 0x04, 0x02, 0x03, 0x02, 0x04, 0x02, 0x03,
0x02, 0x04, 0x02, 0x03, 0x02, 0x04, 0x02, 0x03, 0x02, 0x04, 0x02, 0x03, 0x00, 0x00, 0x00, 0x00,
0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01,
0x00, 0x01, 0x00, 0x01, 0x00, 0x01, 0x00, 0x01, 0x00, 0x01, 0x00, 0x01, 0x00, 0x01, 0x00, 0x01,
0x00, 0x01, 0x00, 0x01, 0x00, 0x01, 0x00, 0x01, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x01, 0x00,
0x00, 0x00, 0x0F, 0x0F, 0x0F, 0x0F, 0x00, 0x00, 0x00, 0x00, 0xF7];
let init_pattern = unpackPattern( init_pattern_msg );
let init_pattern_msg2 = packPattern( init_pattern );
if (!isArraysEqual( init_pattern_msg, init_pattern_msg2 )) {
  console.log( "[td3] something wrong with the pattern serialize/deserialize" );
  console.log( "[td3] init_pattern_msg ", hex2hexstr( init_pattern_msg ) );
  console.log( "[td3] init_pattern", init_pattern );
  console.log( "[td3] init_pattern_msg2", hex2hexstr( init_pattern_msg2 ) );
  console.log( "[td3] isArraysEqual", isArraysEqual( init_pattern_msg, init_pattern_msg2 ) );
  process.exit(-1)
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

let userHandler = (code, value, code_str) => {};
let handler = (code, value, code_str) => {
  userHandler( code, value, code_str );
  onCodeReceived( code, value );
 };
function setHandler( h ) { userHandler = h; }

function messageToCode( msg ) {
  let code = isSysexTD3( msg ) ? msg[7] : isSysex( msg ) ? msg[1] : msg[0];
  VERBOSE_PROMISE_FLOW && console.log( "[td3] messageToCode: ", hex2hexstr( msg ), "-> code: ", hex2hexstr( code ) );
  return code;
}

const MsgDecoder = {
  [MessageTypes.ACK]: (msg) => [msg[8], msg[9]],
  [MessageTypes.MODEL_CODE]: (msg) => hex2str_nullterm( msg.slice( 0x8, msg.length-1 ) ),
  [MessageTypes.PRODUCT_NAME]: (msg) => hex2str_nullterm( msg.slice( 0x8, msg.length-1 ) ),
  [MessageTypes.FIRMWARE_VERSION]: (msg) => `${hex2numstr( msg[0x9] )}.${hex2numstr( msg[0xa] )}.${hex2numstr( msg[0xb] )}`,
  [MessageTypes.CONFIGURATION]: (msg) => unpackConfiguration( msg ),
  [MessageTypes.PATTERN]: (msg) => unpackPattern( msg ),
  [MessageTypes.USB_MIDI_LOOPBACK_REPONSE]: (msg) => hex2hexstr( sysex_td3_unpack( msg ) ),

  [MessageTypes.TESTMODE_TEMPO_KNOB]: (msg) => td3_combine_7bit( msg[2], msg[1] ),
  [MessageTypes.TESTMODE_TRACKPATTERN_GROUP_KNOB]: (msg) => td3_combine_7bit( msg[2], msg[1] ),
  [MessageTypes.TESTMODE_MODE_KNOB]: (msg) => td3_combine_7bit( msg[2], msg[1] ),
  [MessageTypes.TESTMODE_UNKNOWN]: (msg) => td3_combine_7bit( msg[2], msg[1] ),
  [MessageTypes.TESTMODE_BUTTONS]: (msg) => [getTestModeButtonTypesStr( msg[1] ), msg[2] == 1],

  [MessageTypes.MIDI_CONTROL_CHANGE]: (msg) => [getMIDIControlChangeStr( msg[1] ), msg[2]],
}

function message_decode( msg, deltaTime = 0 ) {
  let code = isSysexTD3( msg ) ? msg[7] : !isSysex( msg ) ? msg[0] : undefined;
  if (code) {
    let value = MsgDecoder[code] ? MsgDecoder[code]( msg ) : hex2hexstr( msg.slice(1, msg.length) );
    VERBOSE && console.log( "[td3] ==========================================" );
    VERBOSE && console.log( `${getMessageTypeStr( code )}: `, value );
    handler( code, value, getMessageTypeStr( code ) );
    return;
  }

  // generic
  if (isSysexTD3( msg )) {
    VERBOSE && console.log(`[td3] sysex (td3):\n - m: ${hex2hexstr( msg[0] )},\n      ${hex2hexstr( msg.slice(1,6+1) )},\n      ${hex2hexstr( sysex_td3_unpack( msg ) )},\n      ${hex2hexstr( msg[msg.length-1] )}\n - n: "${hex2numstr( sysex_td3_unpack( msg ) )}"\n - s: "${hex2str( sysex_td3_unpack( msg ) )}"\n - d: ${deltaTime}`);
  } else if (isSysex( msg )) {
    VERBOSE && console.log(`[td3] sysex: m: ${hex2hexstr( sysex_unpack( msg ) )} d: ${deltaTime}`);
  } else {
    VERBOSE && console.log(`[td3] midi: m: ${hex2hexstr( msg )} d: ${deltaTime}`);
  }
}




////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


function test() {
  //send([0x90, 0x30, 0x4F]); // note on
  //send([0x80, 0x30, 0x00]); // note off

  send( Send.GET_MODEL_CODE() );
  send( Send.GET_PRODUCT_NAME() );
  send( Send.GET_FIRMWARE_VERSION() );
  //send( Send.GET_CONFIGURATION() ); // get_firmware_version triggers this for us... :)
  send( Send.GET_PATTERN() );
  /*
  send( Send.SET_PATTERN( {
    group: 0,
    section: 0,
    pitches: [ 36, 39, 36, 39, 39, 36, 39, 46, 24, 24, 24, 24, 24, 24, 24, 24 ],
    accents: [ 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0 ],
    slides: [ 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0 ],
    triplet_mode: 0,
    step_count: 16,
    ties: [ 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1 ],
    rests: [ 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 1, 0, 1, 0 ] }
  ) );
  send( Send.GET_PATTERN() );
  */
}

function test_pattern0() {
  send( Send.SET_PATTERN( {
    group: 0,
    section: 0,
    pitches: [ 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39 ],
    accents: [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ],
    slides: [ 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0 ],
    triplet_mode: 0,
    step_count: 16,
    ties: [ 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1 ],
    rests: [ 0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1, 1, 1, 1 ] }
  ) );
  send( Send.GET_PATTERN() );
  seqStart();
}

function bpmToMs( bpm, steps_per_beat = 16 ) {
  let steps_per_min = bpm * steps_per_beat;
  let steps_per_sec = steps_per_min * (1 / 60); // step/min * 1min/60sec
  let steps_per_msec = steps_per_sec * (1 / 1000); // step/sec * 1sec/1000ms
  let msec_per_step = 1 / steps_per_msec;
  return msec_per_step
}

let bpm = 125;
let start_seq = false;
let interval = false;
let debug_bpm_msg = 0;

// await to receive the reply (only use for MIDI messages that reply)
function send( msg ) {
  return new Promise( (rs, rj) => {
    if (isOpen()) {
      onCodeRequest( messageToCode( msg ), rs )
      sendMessage( msg )
    } else {
      console.log( "[td3] MIDI output is not created... call open()")
      rs();
    }
  })
}

// send without a reply
function sendNoSync( msg ) { sendMessage( msg ) }


/// nodejs:
///   1.3-1.5ms resolution on macos (2019 mbp 16") with both 0ms for setInterval
/// chrome
///   3.6-4.7ms resolution on macos (2019 mbp 16") with both 0ms for setInterval
const setFastestInterval = function( callback ) {
	let start = process.hrtime.bigint(); // nanosec
	//let start = performance.now(); // msec
	//let start = Date.now(); // msec
	const timeout = setInterval( () => {
    let end = process.hrtime.bigint(); // nanosec
    //let end = performance.now(); // msec
	  //let end = Date.now(); // msec
    let diff = Number( end - start ) * 0.000001; // nano to msec
    //let diff = Number( end - start );
    callback( diff * 0.001 ); // msec to sec
    start = end;
	}, 0 );

	return timeout;
};

const clearFastestInterval = function(timeout) {
	clearInterval( timeout );
};

// test for smallest resolution setInterval can handle.
// let td_accum = 0;
// setExactInterval( (td) => {
//   td_accum += td;
//   if (debug_bpm_msg++ % 1000 == 0) { console.log( td_accum/1000.0, td, "average" ); td_accum = 0; }
// }, 0)


// software based sequencer
class Sequencer {
  midi_ch = 0;
  use_seq_clock = false;
  pattern = {"triplet_mode":0,"step_count":16,"pitches":[12,15,19,24,19,15,12,15,19,24,27,31,36,31,27,24],"accents":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"slides":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"ties":[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],"rests":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]};
  runningtime_step = 0;
  runningtime_clock = 0;
  runningtime_total = 0;
  step = 0;
  stepcounter = 0;
  constructor() {
  }
  start() {
    //if (use_seq_clock) {
      sendNoSync([0xFA]); // MIDI SEQ Start (td3 respnds to 0xFB, but other seqs on the chain may need a start msg, so send it!)
      if (this.use_seq_clock) sendNoSync([0xFB]); // TD-3  seq start (requires USB clock, and timing pulse)
      sendNoSync([0xF8]); // send a clock tick
    //}
    this.runningtime = 0
    this.step = 0;
    this.stepcounter = 0;
  }
  update( timedelta ) {
    const steptime = bpmToMs( bpm, 1 ) * 0.001 * (1/4);   // 4  steps per beat
    const clocktime = bpmToMs( bpm, 1 ) * 0.001 * (1/24);
    this.runningtime_clock += timedelta;
    this.runningtime_total += timedelta;
    while (clocktime <= this.runningtime_clock) {
      this.runningtime_clock -= clocktime;
      let next_step = false;

      if (debug_bpm_msg++ % 1000 == 0)  console.log( timedelta, this.runningtime_total, this.runningtime, next_step, steptime, clocktime )

      // fire events
      if (this.use_seq_clock) {
        if (debug_bpm_msg++ % 1000 == 0) console.log( "[td3] ...sending many clocks... interval timer ms=", bpmToMs( bpm ))
        sendNoSync([0xF8]); // send a clock tick
      } else {
        if (this.pattern) {
          sendNoSync([0xF8]); // send a clock tick (hey, i'm the clock source!)
          if (this.stepcounter == 0) {
            let last_step = (this.step + this.pattern.step_count - 1) % this.pattern.step_count;
            let last_pitch = this.pattern.pitches[last_step];
            //let last_accent = this.pattern.accents[last_step];
            let last_slide = this.pattern.slides[last_step];
            let last_rest = this.pattern.rests[last_step];
            let pitch = this.pattern.pitches[this.step];
            let accent = this.pattern.accents[this.step];
            //let slide = this.pattern.slides[this.step];
            let rest = this.pattern.rests[this.step];

            if (!last_slide && last_rest == 0) {
              sendNoSync([ MessageTypes.MIDI_NOTE_OFF + this.midi_ch, last_pitch + 12, 0x00 ] );
            }
            if (rest == 0) {
              sendNoSync([ MessageTypes.MIDI_NOTE_ON + this.midi_ch, pitch + 12, accent ? 0x7F : 0x4F ] );
              console.log( `[note] note:${pitch + 12} vel:${accent ? 0x7F : 0x4F}` )
            }
            if (last_slide && last_rest == 0) {
              sendNoSync([ MessageTypes.MIDI_NOTE_OFF + this.midi_ch, last_pitch + 12, 0x00 ] );
            }

            // advance the step
            this.step = (this.step + 1) % this.pattern.step_count;
          }
        }
      }
      this.stepcounter = (this.stepcounter + 1) % Math.floor(steptime/clocktime)
    }
  }

  stop() {
    //if (use_seq_clock) {
      console.log( "[td3] stopping sequencer" );
      sendNoSync([MessageTypes.MIDI_CONTROL_CHANGE + this.midi_ch, 0x7B, 0x00]); // all notes off
      sendNoSync([0xFC]); // stop seq
    //}
  }

  setPattern( p ) {
    sendNoSync([MessageTypes.MIDI_CONTROL_CHANGE + this.midi_ch, 0x7B, 0x00]); // all notes off
    this.pattern = Object.assign( {}, p ); // shallow object clone
  }
}
let seq = new Sequencer();


function setBpm( b ) {
  bpm = b;
  console.log( `[td3] setting bpm to ${bpm}` )
  console.log( "      ", bpmToMs( bpm, 48 ) );
  if (interval) {
    clearFastestInterval( interval );
  }
  interval = setFastestInterval( (timedelta) => {
    if (start_seq) {
      seq.update( timedelta );
    }
  });
  return true
}

function getBpm() {
  return bpm;
}

// The TD-3 will only respond to start/stop messages from the source it is synchronizing to.
// That is, if you want to control start/stop from the USB MIDI interface,
// the USB MIDI interface must be sync master, and must also emit clock pulses.
function seqStart( clock_src = -1 /* 0 int 1 din 2 usb */ ) {
  console.log( `[td3] starting sequencer` )
  if (0 <= clock_src) sendNoSync(Send.SET_CLOCK_SRC( clock_src ));
  if (!start_seq) {
    seq.start();
  }
  start_seq = true;
  setBpm( bpm );
  return true
}
function seqStop( clock_src = -1 /* 0 int 1 din 2 usb */ ) {
  if (0 <= clock_src) sendNoSync(Send.SET_CLOCK_SRC( clock_src ));
  if (start_seq) { seq.stop(); }
  start_seq = false;
  return true
}
function seqStartToggle() {
  start_seq ? seqStop() : seqStart();
  return start_seq
}
function seqPattern( p ) {
  seq.setPattern( p )
  VERBOSE && console.log( "[td3] td3.seqPattern", JSON.stringify( seq.pattern ) )
}

// return array of indexes that match
function indexOfRegex( ary, regex ) {
  return ary.map( (r, index) => r.match( regex ) ? index : -1 ).filter( r => r != -1 );
}


let isOpen = () => false;
let open = (in_name, out_name) => { console.log( "[td3] open() no implementation" ); };
let close = () => { console.log( "[td3] close() no implementation" ); };
let sendMessage = (msg) => { console.log( "[td3] sendMessage() no implementation" ); };
let getOutputPorts = () => { console.log( "not implemented"); return [] }
let getInputPorts = () => { console.log( "not implemented"); return [] }
let getOutputPort = () => { console.log( "not implemented"); return [] }
let getInputPort = () => { console.log( "not implemented"); return [] }


module.exports = { MessageTypes,
  TestModeButtonTypes,
  MIDIControlChange,
  Send,
  MsgDecoder,
  setVerbose,
  getMessageTypeStr,
  getTestModeButtonTypesStr,
  getMIDIControlChangeStr,
  packPattern,
  setHandler,
  send,
  sendNoSync,
  open,
  isOpen,
  close,
  seqStart,
  seqStop,
  seqPattern,
  setBpm,
  getBpm,
  useNode,
  useElectronBrowser,
}

// pass in require('midi')
function useNode( midi ) {
  let node_state = {
    output: undefined,
    input: undefined,
  }
  let detected_output_index = -1;
  let detected_input_index = -1;

  function midi_isOpen() { return node_state.output && 0 < node_state.output.getPortCount() && 0 < node_state.input.getPortCount() && node_state.output.isPortOpen() && node_state.input.isPortOpen() }

  async function midi_open( in_name = "TD-3", out_name = "TD-3" ) {
    if (node_state.output) delete node_state.output;
    if (node_state.input) delete node_state.input;
    node_state.output = new midi.Output();
    node_state.input = new midi.Input();

    let output_ports = getOutputPorts();
    let output_indexes = indexOfRegex( output_ports, new RegExp( out_name ) )
    detected_output_index = (0 < output_indexes.length) ? output_indexes[0] : 0;
    console.log( `[td3] Output Ports: ${output_ports.length} [${output_ports.map( r=>`\"${r}\"`).join( "," )}]` )

    let input_ports = getInputPorts();
    let input_indexes = indexOfRegex( input_ports, new RegExp( in_name ) )
    detected_input_index = (0 < input_indexes.length) ? input_indexes[0] : 0;
    console.log( `[td3] Input Ports: ${input_ports.length} [${input_ports.map( r=>`\"${r}\"`).join( "," )}]` )

    // setup OUT
    if (0 < output_ports.length) {
      console.log( `[td3] -> Opening Output Port: ${output_ports[detected_output_index]}` );
      node_state.output.openPort(detected_output_index);
      console.log( `[td3]                         ${node_state.output.isPortOpen() ? "success" : "fail"} for port:${detected_output_index}` );
    }

    // setup IN
    if (0 < input_ports.length) {
      console.log( `[td3] -> Opening Input Port: ${input_ports[detected_input_index]}` );

      // Configure a callback.
      node_state.input.on('message', (deltaTime, message) => {
        // The message is an array of numbers corresponding to the MIDI bytes:
        //   [status, data1, data2]
        // https://www.cs.cf.ac.uk/Dave/Multimedia/node158.html has some helpful
        // information interpreting the messages.
        message_decode( message, deltaTime );
      });

      // Open the detected input port.
      node_state.input.openPort(detected_input_index);
      console.log( `[td3]                         ${node_state.input.isPortOpen() ? "success" : "fail"} for port:${detected_input_index}` );

      // Sysex, timing, and active sensing messages are ignored
      // by default. To enable these message types, pass false for
      // the appropriate type in the function below.
      // Order: (Sysex, Timing, Active Sensing)
      // For example if you want to receive only MIDI Clock beats
      // you should use
      // input.ignoreTypes(true, false, true)
      node_state.input.ignoreTypes(false, false, false);
    }
  }

  function midi_sendMessage( msg ) {
    node_state.output ? node_state.output.sendMessage( msg ) : console.log( "[td3] MIDI output is not created... call open()")
  }

  function midi_close() {
    if (node_state.input) {
      console.log( "[td3] closing input" );
      node_state.input.closePort();
      delete node_state.input;
      node_state.input = undefined;
    }

    if (node_state.output) {
      console.log( "[td3] closing output" );
      node_state.output.closePort();
      delete node_state.output;
      node_state.output = undefined;
    }
    //process.exit( 0 );
  }

  // patch them in
  module.exports.isOpen = isOpen = midi_isOpen;
  module.exports.open = open = midi_open;
  module.exports.close = close = midi_close;
  module.exports.sendMessage = sendMessage = midi_sendMessage;
  module.exports.getOutputPorts = getOutputPorts = () => node_state.output ? [...Array(node_state.output.getPortCount()).keys()].map( r => node_state.output.getPortName( r ) ) : [];
  module.exports.getInputPorts = getInputPorts = () => node_state.input ? [...Array(node_state.input.getPortCount()).keys()].map( r => node_state.input.getPortName( r ) ) : [];
  module.exports.getOutputPort = getOutputPort = () => node_state.output.isPortOpen() && detected_output_index >= 0 ? node_state.output.getPortName( detected_output_index ) : undefined;
  module.exports.getInputPort = getInputPort = () => node_state.input.isPortOpen() && detected_input_index >= 0 ? node_state.input.getPortName( detected_input_index ) : undefined;
}


// call with the Angular this.electronService.ipcRenderer
function useElectronBrowser( ipcRenderer ) {
  function bind( func ) { module.exports[func] = async (...args) => {
    let result = await ipcRenderer.invoke('td3', func, ...args );
    console.log(
      [
        `[td3] ipcRenderer.invoke('td3', "${func}"`,
        ...args.map( r => `${JSON.stringify( r )}` )
      ].join( ",") + `) => ${JSON.stringify( result )}`
    );
    return result;
  }}
  [
    "isOpen",
    "send",
    "sendNoSync",
    "open",
    "close",
    "getBpm",
    "setBpm",
    "setVerbose",
    "seqStart",
    "seqStop",
    "seqPattern",
    "getOutputPorts",
    "getInputPorts",
    "getOutputPort",
    "getInputPort",
  ].forEach( r => bind( r ) );

  module.exports.setHandler = (...args) => {
    console.log( `[td3] setHandler wont work, use
      this.electronService.ipcRenderer.on( 'handler', (e, code_str, value) => {
        this.zone.run(()=>{
          /* code goes here */
        })
      }).

      And on the NodeJS side, use:
      td3.setHandler( (code, value, code_str) => {
        win.webContents.send( 'handler', code_str, value );
      })
    `);
  };
}
