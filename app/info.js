#!/usr/bin/env node

//require = require('esm')( module )
let td3 = require('./td3');
td3.useNode( require( "midi" ) );

let VERBOSE=false
let TESTMODE=false
let BPM=-1
let SEQSTART=false
let CLOCK_SRC=-1
let args=[]

/////////////////////////////////////
// scan command line args:
function usage()
{
  console.log( `${process.argv[1]} td3 info tool` );
  console.log( `Usage:
  ${process.argv[1]} --bpm <bpm>    (set sequencer bpm)
  ${process.argv[1]} --start        (start sequencer)
  ${process.argv[1]} --clock        (set clock src: 0 Int 1 MIDI DIN 2 MIDI USB 3 Trigger)
  ${process.argv[1]} --test
   ${process.argv[1]} --help        (this help)
   ${process.argv[1]} --verbose     (output verbose information)
  ` );
}
let ARGC = process.argv.length-2; // 1st 2 are node and script name...
let ARGV = process.argv;
let non_flag_args = 0;
let non_flag_args_required = 0;
for (let i = 2; i < (ARGC+2); i++) {
  if (ARGV[i] == "--help") {
    usage();
    process.exit( -1 )
  }

  if (ARGV[i] == "--verbose") {
    VERBOSE=true
    continue
  }
  if (ARGV[i] == "--test") {
    TESTMODE=true
    continue
  }
  if (ARGV[i] == "--start") {
    SEQSTART=true
    continue
  }
  if (ARGV[i] == "--bpm") {
    i+=1;
    BPM=parseInt( ARGV[i] )
    continue
  }
  if (ARGV[i] == "--clock") {
    i+=1;
    CLOCK_SRC=parseInt( ARGV[i] )
    continue
  }
  if (ARGV[i].substr(0,2) == "--") {
    console.log( `Unknown option ${ARGV[i]}` );
    process.exit(-1)
  }

  args.push( ARGV[i] )
  VERBOSE && console.log( `Parsing Args: argument #${non_flag_args}: \"${ARGV[i]}\"` )
  non_flag_args += 1
}

// output help if they're getting it wrong...
if (non_flag_args_required != 0 && (ARGC == 0 || !(non_flag_args >= non_flag_args_required))) {
  (ARGC > 0) && console.log( `Expected ${non_flag_args_required} args, but only got ${non_flag_args}` );
  usage();
  process.exit( -1 );
}
//////////////////////////////////////////

// main:
let configuration;
(async () => {
  await td3.open();

  let model = await td3.send( td3.Send.GET_MODEL_CODE() );
  let name = await td3.send( td3.Send.GET_PRODUCT_NAME() );
  let pattern = await td3.send( td3.Send.GET_PATTERN() );
  let version = await td3.send( td3.Send.GET_FIRMWARE_VERSION() );

  if (0 <= CLOCK_SRC) await td3.send( td3.Send.SET_CLOCK_SRC( CLOCK_SRC ) );
  configuration = await td3.send( td3.Send.GET_CONFIGURATION() );
  console.log( name, model, version )
  console.log( "pattern: ", pattern )
  console.log( "configuration: ", configuration )

  if (TESTMODE) await td3.send( td3.Send.SET_TEST_MODE(TESTMODE) );

  td3.setVerbose( VERBOSE );
  if (0 < BPM) td3.setBpm( BPM );
  if (SEQSTART) {
    console.log( "set clock source to ", 0x02 );
    await td3.send( td3.Send.SET_CLOCK_SRC( 0x02 ) ); // set to external usb midi sync
    td3.seqStart();
  }

  //td3.test_pattern0();
})()


process.on('SIGINT', async function() {
  console.log("");
  console.log("Caught interrupt signal");

  console.log( "return clock source to ", configuration.clock_src );
  await td3.send( td3.Send.SET_CLOCK_SRC( configuration.clock_src ) ); // set back
  td3.seqStop();
  td3.close();
  process.exit( 0 );
});
