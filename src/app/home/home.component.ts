import { Component, OnInit, NgZone, HostListener, OnChanges/*, SimpleChanges*/ } from '@angular/core';
import { Router } from '@angular/router';
import { ElectronService } from '../core/services/electron/electron.service';
import * as td3 from '../../../app/td3';
import * as stepseq from '../../../app/stepseq';
import { getConfigFileParsingDiagnostics } from 'typescript/lib/tsserverlibrary';
import { group } from 'console';
@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit/*, OnChanges*/ {
  midiout;
  td3 = td3;
  midi_inputport; // current selected port
  midi_inputports; // all available ports
  midi_outputport; // current selected port
  midi_outputports; // all available ports
  seq: any;
  name: string = "1234";
  model: string = "1234";
  version: string = "1234";
  //pattern: any = {"group":0,"section":0,"triplet_mode":0,"step_count":16,"pitches":[36,24,36,24,36,39,47,24,36,24,36,24,39,24,37,48],"accents":[0,1,0,0,0,0,1,0,0,0,0,1,0,0,0,0],"slides":[0,0,0,0,1,1,0,0,0,0,1,0,1,0,1,0],"ties":[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],"rests":[0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0]};
  pattern: any = {"group":0,"section":0,"triplet_mode":0,"step_count":16,"pitches":[12,15,19,24,19,15,12,15,19,24,27,31,36,31,27,24],"accents":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"slides":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"ties":[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],"rests":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]};
  bpm: number = -1;
  rows: any = [];
  lastStep: number = -1;
  lastPitch: number = -1;
  config: any;
  isPlaying: boolean;
  //group: number;
  //section: number;
  //step_count: number;
  step_count_values = [];
  pianowhite = [1,0,1,0,1,1,0,1,0,1,0,1] // MIDI 'C1' value of 0x18
  pianonotes = [' C', 'C#', ' D', 'D#', ' E', ' F', 'F#', ' G', 'G#', ' A', 'A#', ' B' ]
  stringRef = String;
  mathRef = Math;
  minNote = 0x0c;
  maxNote = 0x31;
  AB=0;
  hear=true;

  key_priority_lookup = [ [0x00, "Low"], [0x01, "Hi"], [0x02, "Last"] ];
  clock_trigger_rate_lookup = [ [0x00, "1 PPS"], [0x01, "2 PPQ"], [0x02, "24 PPQ"], [0x08, "48 PPQ"] ];
  clock_src_lookup = [ [0x00, "Int"], [0x01, "MID"], [0x02, "USB"], [0x03, "Trg"] ];

  // config:
  midi_out_channel = 0;       // int  0-15
  midi_in_channel = 0;        // int  0-15
  midi_transpose = 0;         // int  [-12 <0x00> to 0 <0x0C> to +12 <0x18>]
  pitch_bend_semitones = 0;   // int  0-12
  key_priority = 0;           // enum 0x00 - Low, 0x01 - High, 0x02 - Last
  multi_trigger_mode = 0;     // bool 0-1
  clock_trigger_polarity = 0  // enum 0x00 - Fall, 0x01 - Rise
  clock_trigger_rate = 0;     // enum 0x00 - 1 PPS, 0x01 - 2 PPQ, 0x02 - 24 PPQ, 0x08 - 48 PPQ
  clock_src = 0;              // enum 0x00 - Internal, 0x01 - MIDI DIN, 0x02 - MIDI USB, 0x03 - Trigger
  accent_vel_threshold = 0;   // int  0 to 127


  constructor(private router: Router, private electronService: ElectronService, private zone:NgZone) {
    for (let x = this.minNote; x < this.maxNote; ++x) {
      this.rows.push( x )
    }
    for (let x = 0; x <= 16; ++x) {
      this.step_count_values.push( x )
    }

    td3.useElectronBrowser( this.electronService.ipcRenderer );
  }

  ngOnInit(): void {
    console.log('[HomeComponent] ngOnInit()');
    this.init();
  }
  // ngOnChanges(changes: SimpleChanges) {
  //   // changes.prop contains the old and the new value...
  //   console.log( "Changes: " )
  //   console.log( changes.prop )
  // }

  async openPort( e ) {
    console.log( "openPort", e.target.value );
    //await td3.open( e );
  }
  async init( inputport = undefined, outputport = undefined ) {
    this.pattern.group = this.getLocalStorage( "group", 0 )
    this.pattern.section = this.getLocalStorage( "section", 0 )
    this.hear = this.getLocalStorage( "hear", 0 )
    inputport = inputport !== undefined ? inputport : this.getLocalStorage( "midi_input", inputport !== undefined ? inputport : "TD-3" )
    outputport = outputport !== undefined ? outputport : this.getLocalStorage( "midi_output", outputport !== undefined ? outputport : "TD-3" )
    await td3.close();
    this.name = ""
    this.model = ""
    this.version = ""
    await td3.open( inputport, outputport );
    this.midi_outputports = await td3.getOutputPorts();
    this.midi_outputport = await td3.getOutputPort();
    this.midi_inputports = await td3.getInputPorts();
    this.midi_inputport = await td3.getInputPort();
    if (await td3.isOpen()) {
      this.name = "Behringer " + await td3.send( td3.Send.GET_PRODUCT_NAME() );
      this.model = await td3.send( td3.Send.GET_MODEL_CODE() );
      this.version = await td3.send( td3.Send.GET_FIRMWARE_VERSION() );
      await this.getConfig();
      this.seq = td3;

      // set the port in localStorage if it worked so it defaults next time in
      this.setLocalStorage( "midi_input", await td3.getInputPort() )
      this.setLocalStorage( "midi_output", await td3.getOutputPort() )
    } else {
      this.name = "Web";
      this.model = "Audio";
      this.version = "1";
      this.seq = stepseq;
    }

    await this.getPattern();
    await this.addUndoData( { pattern: this.pattern } );
    this.bpm = await this.seq.getBpm();
  }
  reconnect() {
    this.init();
  }

  async sectionChange(e) {
    await this.setSection( parseInt( e.target.value ) );
  }
  async groupChange(e) {
    await this.setGroup( parseInt( e.target.value ) );
  }
  async stepCountChange(e) {
    await this.setStepCount( parseInt( e.target.value ) );
  }
  async sendPattern( pattern, group = undefined, section = undefined ) {
    let p = Object.assign( {}, pattern ); // shallow clone object
    p.ties = p.ties.map( r => 1 ) // we dont edit ties, just clear them
    p.group = group !== undefined ? group : p.group;
    p.section = section !== undefined ? section : p.section;
    if (await td3.isOpen()) {
      await td3.send( td3.Send.SET_PATTERN( p ) );
    }
    //console.log( JSON.stringify( this.pattern ) );
  }
  async onPatternChanged( log_undo = true ) {
    await this.sendPattern( this.pattern )
    await this.getPattern(); // always read it back so we are displaying what's on the device (in case it fails, or whatever)
    if (log_undo)
      await this.addUndoData( { pattern: this.pattern } );
    //console.log( JSON.stringify( this.pattern ) );
  }
  out() {
    console.log( JSON.stringify( this.pattern ) );
  }
  async start() {
    if (await td3.isOpen()) {
      //await td3.seqStart( 0x02 /* usb */ )
      await td3.seqStart()
    } else {
      stepseq.setPattern( this.pattern );
      stepseq.seqStart();
    }
    this.isPlaying = true;
    this.getConfig();
  }
  async stop() {
    if (await td3.isOpen()) {
      //await td3.seqStop( 0x00 /* internal */ )
      await td3.seqStop()
    } else {
      stepseq.seqStop();
    }
    this.isPlaying = false;
    this.getConfig();
  }
  async setBpm( val ) {
    if (await td3.isOpen()) {
      await td3.setBpm( val )
      this.bpm = await td3.getBpm();
    } else {
      stepseq.setBpm( val );
      this.bpm = stepseq.getBpm();
    }
  }
  async getPattern() {
    if (await td3.isOpen()) {
      //console.log( "before get pattern: " , this.pattern )
      this.pattern = await td3.send( td3.Send.GET_PATTERN( this.pattern.group, this.pattern.section ) )
      td3.seqPattern( this.pattern ); // set the software sequencer's pattern
      this.AB = this.pattern.section < 8 ? 0 : 1;
      this.loadUndo();
      //console.log( "after get pattern: " , this.pattern )
      await this.getConfig();
    }
  }
  async getConfig() {
    if (await td3.isOpen()) {
      let config = await td3.send( td3.Send.GET_CONFIGURATION() );
      for (let c of Object.keys( config )) {
        if (c == "clock_trigger_rate") {
          this.clock_trigger_rate = config.clock_trigger_rate != 0x08 ? config.clock_trigger_rate : 0x03;
        } else {
          this[c] = config[c];
        }
      }
    }
  }

  // debug.... toggle something.
  barf = true;
  async tog() {
    this.pattern = await td3.send( td3.Send.GET_PATTERN( this.pattern.group, this.pattern.section ) )
    this.barf = !this.barf
    this.pattern.pitches[4] = this.barf ? 24 : 32
  }

  async toggleAccent() {
    if (this.lastStep != -1 && this.lastPitch != -1) {
      this.pattern.accents[this.lastStep] = !this.pattern.accents[this.lastStep];
      await this.onPatternChanged();
      if (this.hear) this.sendAuditionNote( this.pattern.pitches[this.lastStep], this.pattern.accents[this.lastStep] == 1 );
    }
  }
  async toggleSlide() {
    if (this.lastStep != -1 && this.lastPitch != -1) {
      this.pattern.slides[this.lastStep] = !this.pattern.slides[this.lastStep];
      await this.onPatternChanged();
      if (this.hear) this.sendAuditionNote( this.pattern.pitches[this.lastStep], this.pattern.accents[this.lastStep] == 1 );
    }
  }

  selectColumn( event, step ) {
    if (this.lastPitch != -1 && this.lastStep == step) {
      this.lastPitch = -1;
    } else if (this.lastStep != step)
      this.lastStep = step;
    else
      this.lastStep = -1
    //event.stopPropagation();
  }

  async setPitch( event, step, pitch, slide ) {
    let pitch_was = this.pattern.pitches[step];
    let slide_was = this.pattern.slides[step];
    let accent_was = this.pattern.accents[step];
    let rest_was = this.pattern.rests[step];


    // clicked onto a note
    if (pitch == pitch_was && rest_was == 0) {
      if (slide_was != slide) {
        // just change the slide
        this.pattern.slides[step] = slide;
        // make sure we re-select it...
        this.lastStep = -1;
        this.lastPitch = -1;
      }

      //console.log( this.lastStep, step, " : ", this.lastPitch, pitch )
      if (this.lastStep != step || this.lastPitch != pitch) {
        // just select the slot
        this.lastStep = step;
        this.lastPitch = pitch;
        //console.log( "selecting:", step, pitch )
        await this.onPatternChanged();
        if (this.hear) this.sendAuditionNote( pitch, accent_was == 1 );

        return
      }

      // disable
      this.pattern.rests[step] = 1;
      this.pattern.pitches[step] = 0x18;
      this.lastStep = -1;
      this.lastPitch = -1;
    }
    // clicked onto an empty cell
    else {
      // enable
      this.pattern.rests[step] = 0;
      this.pattern.slides[step] = slide;
      this.pattern.pitches[step] = pitch;
      this.lastStep = step;
      this.lastPitch = pitch;
    }

    await this.onPatternChanged();
    if (this.hear) this.sendAuditionNote( pitch, accent_was == 1 );
  }

  // 0x4F // normal velocity
  // 0x7f // accent velocity
  sendAuditionNote( note, acc:boolean = false ) {
    td3.send( [ td3.MessageTypes.MIDI_NOTE_ON, note + 12, acc ? 0x7F : 0x4F ] );
    setTimeout( () => {
      td3.send( [ td3.MessageTypes.MIDI_NOTE_OFF, note + 12, 0x00 ] );
    }, 500)
  }

  async onKeyDown( e ) {
    if (e.code=="Space") {
      this.isPlaying ? this.stop() : this.start()
    }
  }

  @HostListener('document:keydown.esc')
  @HostListener('document:keydown.q')
  async exit() {
    await this.electronService.ipcRenderer.invoke( 'exit' );
  }

  event2xy( e ) {
    var rect = e.target.getBoundingClientRect();
    var x = e.clientX - rect.left; //x position within the element.
    var y = e.clientY - rect.top;  //y position within the element.
    return [x,y]
  }
  event2wh( e ) {
    var rect = e.target.getBoundingClientRect();
    var w = rect.right - rect.left; //x position within the element.
    var h = rect.bottom - rect.top;  //y position within the element.
    return [w,h]
  }

  // onButton2Side( e, func1, func2 ) {
  //   return this.event2xy(e)[0] < (this.event2wh(e)[0]/2) ? func1() : func2();
  // }

  // tap on the left of the button to dec, right of the button to inc.
  async onStepsButton(e){
    this.event2xy(e)[0] < (this.event2wh(e)[0]/2) ?
      (this.pattern.step_count = this.pattern.step_count <= 1  ?  1 : this.pattern.step_count - 1) :
      (this.pattern.step_count = 16 <= this.pattern.step_count ? 16 : this.pattern.step_count + 1);
    await this.onPatternChanged();
  }

  // tap on the left of the button to dec, right of the button to inc.
  onBpmButton(e){
    this.setBpm( this.event2xy(e)[0] < (this.event2wh(e)[0]/2) ? this.bpm - 5 : this.bpm + 5 )
  }

  // tap on the left of the button to dec, right of the button to inc.
  onGroupButton(e){
    console.log( this.pattern.group )
    this.setGroup( this.event2xy(e)[0] < (this.event2wh(e)[0]/2) ? Math.max( 0, this.pattern.group - 1 ) : Math.min( 3, this.pattern.group + 1 ) )
    console.log( this.pattern.group )
  }

  async setStepCount( sc ) {
    this.pattern.step_count = sc
    await this.onPatternChanged();
  }

  async setSection( s ) {
    this.reduceUndo(); // clear/reduce the undo history since we're navigating away from this group/section

    this.pattern.section = s;
    this.setLocalStorage( "section", this.pattern.section )
    await this.getPattern();
    await this.addUndoData( { pattern: this.pattern } );
  }

  async setGroup( g ) {
    this.reduceUndo(); // clear/reduce the undo history since we're navigating away from this group/section

    this.pattern.group = g;
    this.setLocalStorage( "group", this.pattern.group )
    await this.getPattern();
    await this.addUndoData( { pattern: this.pattern } );
  }

  async clear() {
    for (let x = 0; x < this.pattern.rests.length; ++x) {
      this.pattern.rests[x] = 1;
    }
    for (let x = 0; x < this.pattern.pitches.length; ++x) {
      this.pattern.pitches[x] = 0x18;
    }
    this.lastStep = -1;
    this.lastPitch = -1;

    await this.onPatternChanged();
  }
  async random() {
    for (let x = 0; x < this.pattern.rests.length; ++x) {
      this.pattern.rests[x] = Math.floor(Math.random() + 0.5); // between 0..1  +  0.5
    }
    for (let x = 0; x < this.pattern.pitches.length; ++x) {
      this.pattern.pitches[x] = Math.floor( (Math.random() * this.maxNote) + this.minNote );
    }
    for (let x = 0; x < this.pattern.accents.length; ++x) {
      this.pattern.accents[x] = Math.floor(Math.random() + 0.25); // between 0..1  +  0.25
    }
    for (let x = 0; x < this.pattern.pitches.length; ++x) {
      this.pattern.slides[x] = Math.floor(Math.random() + 0.50); // between 0..1  +  0.5
    }
    this.lastStep = -1;
    this.lastPitch = -1;

    await this.onPatternChanged();
  }

  async onClockTriggerRate() {
    // 0x00 - 1 PPS, 0x01 - 2 PPQ, 0x02 - 24 PPQ, 0x08 - 48 PPQ (only valid when clock src is TRIGGER)
    this.clock_trigger_rate = (this.clock_trigger_rate + 1) % 4;
    await td3.send( td3.Send.SET_CLOCK_TRIGGER_RATE( this.clock_trigger_rate_lookup[this.clock_trigger_rate][0] ) );
  }

  async onClockSrc() {
    // enum 0x00 - Internal, 0x01 - MIDI DIN, 0x02 - MIDI USB, 0x03 - Trigger
    this.clock_src = (this.clock_src + 1) % 4;
    await td3.send( td3.Send.SET_CLOCK_SRC( this.clock_src_lookup[this.clock_src][0] ) );
  }

  async onKeyPriority() {
    // enum 0x00 - Low, 0x01 - High, 0x02 - Last
    this.key_priority = (this.key_priority + 1) % 3;
    await td3.send( td3.Send.SET_KEYPRIORITY( this.key_priority_lookup[this.key_priority][0] ) );
  }

  async toggleAB() {
    this.AB = this.AB == 0 ? 1 : 0;
    await this.setSection( (this.pattern.section % 8) + this.AB * 8 );
  }

  // return false if storage was full, or true on success
  setLocalStorage(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value))
      return true;
    } catch (e) {
      /// quota probably exceeded:
      ///  Chrome has DOMException.QUOTA_EXCEEDED_ERR which is 22, firefox has code == 1014
      ///  e.code === "22" || e.code === "1014"
      ///  e.name == "QuotaExceededError" || e.name == "NS_ERROR_DOM_QUOTA_REACHED" || e.name == "QUOTA_EXCEEDED_ERR"
      /// inconsistent across browsers, so... just catch any error
      return false;
    }
  }

  getLocalStorage(key, default_value = undefined) {
    let value = localStorage.getItem(key);
    return value ? JSON.parse( value ) : default_value;
  }

  delLocalStorage(key) {
    localStorage.removeItem(key)
  }

  // UNDO & REDO
  canUndo() {
    return this.undodata && 0 < this.undodata.history.length && 0 < this.undodata.position;
  }
  canRedo() {
    return this.undodata && this.undodata.position < (this.undodata.history.length - 1);
  }

  static readonly undodata_default:any = { position: 0, history: [] };
  undodata:any = Object.assign( {}, HomeComponent.undodata_default ); // shallow clone object
  clearUndo() {
    this.undodata = Object.assign( {}, HomeComponent.undodata_default ); // shallow clone object
    this.saveUndo();
    this.loadUndo();
  }
  reduceUndo() {
    const expire_count = 25;
    if (expire_count < this.undodata.history.length) {
      // throw out any redo
      this.undodata.history = 0 < this.undodata.history.length ? this.undodata.history.slice( 0, this.undodata.position+1 ) : this.undodata.history;
    }
    if (expire_count < this.undodata.history.length) {
      // throw out really old undo...
      this.undodata.history = 0 < this.undodata.history.length ? this.undodata.history.slice( this.undodata.history.length - expire_count, this.undodata.history.length ) : this.undodata.history;
    }

    this.saveUndo();
    this.loadUndo();
  }
  loadUndo() {
    this.undodata = this.getLocalStorage( `undo ${this.pattern.group} ${this.pattern.section}` );
    if (this.undodata == undefined) {
      this.clearUndo();
    }
  }
  saveUndo() {
    this.setLocalStorage( `undo ${this.pattern.group} ${this.pattern.section}`, this.undodata );
  }

  @HostListener('document:keydown.control.z')
  @HostListener('document:keydown.meta.z')
  async undo(/*event: KeyboardEvent*/) {
    if (this.canUndo()) {
      // decrement the position
      this.undodata.position = Math.max( 0, this.undodata.position - 1 );
      console.log( `undo!  level ${this.undodata.position}`, this.undodata )
      this.saveUndo();

      // pattern at this undo level
      let data = JSON.parse( JSON.stringify( this.undodata.history[this.undodata.position] ) ); // simple deep clone
      this.pattern = data.pattern;
      await this.onPatternChanged( false );
    }
  }
  @HostListener('document:keydown.control.shift.z')
  @HostListener('document:keydown.meta.shift.z')
  async redo(/*event: KeyboardEvent*/) {
    if (this.canRedo()) {
      // increment the position
      this.undodata.position = Math.min( this.undodata.history.length - 1, this.undodata.position + 1 );
      console.log( `redo!  level ${this.undodata.position}`, this.undodata )
      this.saveUndo();

      // pattern at this undo level
      let data = JSON.parse( JSON.stringify( this.undodata.history[this.undodata.position] ) ); // simple deep clone
      this.pattern = data.pattern;
      await this.onPatternChanged( false );
    }
  }

  addUndoData( data ) {
    // adding undo data
    console.log( "undodata", this.undodata )
    console.log( "history", this.undodata ? this.undodata.history : undefined )
    if (JSON.stringify(data) != JSON.stringify( this.undodata.history[this.undodata.position] )) {
      this.undodata.history = 0 < this.undodata.history.length ? this.undodata.history.slice( 0, this.undodata.position+1 ) : this.undodata.history;

      this.undodata.history.push( JSON.parse(JSON.stringify(data)) ); // simple deep clone
      this.undodata.position = this.undodata.history.length - 1;
      this.saveUndo();
      console.log( `history!  level ${this.undodata.position}` )
    } else {
      console.log( `history!  level ${this.undodata.position} (skipped, already present)` )
    }
  }

  // COPY & PASTE
  copybuffer:any = undefined;
  canPaste() {
    return this.copybuffer != undefined;
  }
  copy() {
    this.copybuffer = JSON.parse( JSON.stringify( this.pattern ) ); // simple deep clone
  }
  async paste( buffer = undefined ) {
    // preserve the current group/section
    let group = this.pattern.group;
    let section = this.pattern.section;
    this.pattern = JSON.parse( JSON.stringify( buffer ? buffer : this.copybuffer ) ); // simple deep clone
    this.pattern.group = group;
    this.pattern.section = section;
    await this.onPatternChanged();
  }

  toggleHear() {
    this.hear = !this.hear;
    this.setLocalStorage( "hear", this.hear )
  }

  settings:boolean = false;

  async getAllPatterns() {
    let data = [];
    for (let g = 0; g < 4; ++g) {
      for (let s = 0; s < 16; ++s) {
        let pattern = await td3.send( td3.Send.GET_PATTERN( g, s ) )
        data.push( pattern );
      }
    }
    return data;
  }
  async save() {
    this.inSaveLoad = true;
    await this.electronService.ipcRenderer.invoke( 'save', "backup.json", JSON.stringify( await this.getAllPatterns() ) );
    this.inSaveLoad = false;
  }

  async load() {
    this.inSaveLoad = true;
    let group = this.pattern.group;
    let section = this.pattern.section;

    let data = await this.electronService.ipcRenderer.invoke( 'load', "backup.json" );
    if (data) {
      data = JSON.parse( data );
      for (let d of data) {
        await this.setGroup( d.group );
        await this.setSection( d.section );
        await this.paste( d );
      }

      await this.setGroup( group );
      await this.setSection( section );
      this.settings = false; // exit the menu
    }
    this.inSaveLoad = false;
  }

  inSaveLoad:boolean = false;
  async savePattern(name) {
    this.inSaveLoad = true;
    let p = Object.assign( {}, this.pattern ); // shallow clone object
    delete p.group
    delete p.section
    await this.electronService.ipcRenderer.invoke( 'save', `backup-${name}.json`, JSON.stringify( p ) );
    this.inSaveLoad = false;
  }

  async loadPattern(name) {
    this.inSaveLoad = true;
    let d = await this.electronService.ipcRenderer.invoke( 'load', `backup-${name}.json` );
    if (d) {
      await this.paste( JSON.parse( d ) );
      this.settings = false; // exit the menu
    }
    this.inSaveLoad = false;
  }

  getPatternName() {
    return `${["I","II","III","IV"][this.pattern.group]}${(this.pattern.section%8) + 1}${this.pattern.section < 8 ? "A" : "B"}`
  }
}
