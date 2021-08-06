
// WebAudioAPISoundManager Constructor
let WebAudioAPISoundManager = function (context) {
  this.context = context;
  this.bufferList = {};
  console.log( "[WebAudioAPISound] WebAudioAPISoundManager v0.0.1")
};

// WebAudioAPISoundManager Prototype
WebAudioAPISoundManager.prototype = {
  addSound: function( url, sound ) {
    // Load buffer asynchronously
    let request = new XMLHttpRequest();
    request.open( "GET", encodeURI( url ), true );
    request.responseType = "arraybuffer";
    request.onload = () => {
      if (this.context) 
        this.context.decodeAudioData( request.response ).then(
          (buffer) => {
            if (!buffer) { console.log('[WebAudioAPISound] error decoding file data: ' + url); return; }
            this.bufferList[url] = buffer;
          },
          (err) => sound.onerror && sound.onerror()
        )
      else
        console.log( "[WebAudioAPISound] context is undefined", "WebAudioAPISoundManager.onload", url, request.response );
    };
    request.onerror = function () {
      sound.onerror && sound.onerror();
      console.log('[WebAudioAPISound] BufferLoader: XHR error');
    };
    request.send();
  },
  bufferList: {}  // indexed by url
};


// WebAudioAPISound Constructor (compatible with Audio)
// usage:
//   smashSound = new WebAudioAPISound("smash.mp3");
//   backgroundMusic = new WebAudioAPISound("smooth-jazz.mp3", {loop: true});
var WebAudioAPISound = function (url, options) {
   this.settings = Object.assign( { loop: false }, options );
   this.url = url;
   window.AudioContext = window.AudioContext || window.webkitAudioContext;
   window.audioContext = new window.AudioContext();
   window.webAudioAPISoundManager = window.webAudioAPISoundManager || new WebAudioAPISoundManager(window.audioContext);
   this.manager = window.webAudioAPISoundManager;
   this.manager.addSound(this.url, this);
};

function cv2rate( cv )
{
    let cv_pow2 = Math.pow( 2, cv ); // do pow(2,x) to the cv...
    return cv_pow2;
}
function cv2freq( cv )
{
    let cv_pow2 = Math.pow( 2, cv ); // do pow(2,x) to the cv...
    return cv_pow2 * 8.1757989156;  // frequency of C0
}
function note2cv( note ) {
  return note * 0.0833333333333; // div by 12
}
function note2rate( note, base_note ) {
  return cv2rate( note2cv( note - base_note ));
}
function test_pitchcalc() {
  
  for (let i = 12; i < 52; ++i) {
    console.log( `[test_pitchcalc] oct:${Math.floor( i/12 )} note:${i} sub:${i - 24} playback_rate:${note2rate( i, 24 )}` )
  }
}
test_pitchcalc()

// WebAudioAPISound Prototype
WebAudioAPISound.prototype = {
  set src( url ) { this.url = url },
  get src() { return this.url },
  load() { this.manager.addSound( this.url, this ) },
  play( options = {} ) {
    var buffer = this.manager.bufferList[this.url];
    //console.log( "play", buffer );
    if (typeof buffer !== "undefined") {
      this.source = this.makeSource( buffer );
      this.source.loop = this.settings.loop;
      if (options && options.base_pitch && options.pitch) {
        this.source.playbackRate.value = note2rate( options.pitch, options.base_pitch );  
      } else if (options && options.playbackRate) {
        this.source.playbackRate.value = options.playbackRate;  
      } else {
        this.source.playbackRate.value = this.playbackRate;
      }
      this.source.start(0);
      //VERBOSE && console.log( "[WebAudioAPISound] play" );
    }
  },
  stop() { this.source.stop() },
  getVolume() { this.translateVolume(this.volume, true) },
  setVolume( volume /* 0-100 */ ) { this.volume = this.translateVolume( volume ) },
  translateVolume( volume, inverse ) { inverse ? volume * 100 : volume / 100 },
  makeSource: function (buffer) {
    var source = this.manager.context.createBufferSource();
    var gainNode = this.manager.context.createGain();
    gainNode.gain.setTargetAtTime( this.volume ? this.volume : 0.5, this.manager.context.currentTime + 1, 0.5 );
    source.buffer = buffer;
    source.connect(gainNode);
    gainNode.connect(this.manager.context.destination);
    return source;
  },
  playbackRate: 1.0,
  onerror() { console.log( "[WebAudioAPISound] no error registered for: " + this.url ) }
};

// replace Audio system with WebAudioAPISound, if supported
// try {
//   window.AudioContext = window.AudioContext || window.webkitAudioContext;
//   window.audioContext = new window.AudioContext();
//   Audio = WebAudioAPISound;
//   console.log( "WebAudio Initialized - Replaced your Audio with WebAudioAPISound!")
// } catch (e) {
//   console.log( "No Web Audio API support" );
// }

module.exports = WebAudioAPISound;
