import { Component, OnInit, NgZone, HostListener, OnChanges/*, SimpleChanges*/ } from '@angular/core';
import { Router } from '@angular/router';
import { ElectronService } from '../core/services/electron/electron.service';
import * as td3 from '../../../app/td3';
import * as stepseq from '../../../app/stepseq';
@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit/*, OnChanges*/ {
  midiout;
  td3 = td3;
  ports;
  seq: any;
  name: string = "1234";
  model: string = "1234";
  version: string = "1234";
  pattern: any = {"group":0,"section":0,"pitches":[12,15,19,24,19,15,12,15,19,24,27,31,36,31,27,24],"accents":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"slides":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"triplet_mode":0,"step_count":16,"ties":[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],"rests":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]};
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

  constructor(private router: Router, private electronService: ElectronService, private zone:NgZone) {
    for (let x = 0x0c; x < 0x31; ++x) {
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
  async init() {
    await td3.close();
    await td3.open();
    this.ports = await td3.getPorts();
    if (await td3.isOpen()) {
      this.name = "Behringer " + await td3.send( td3.Send.GET_PRODUCT_NAME() );
      this.model = await td3.send( td3.Send.GET_MODEL_CODE() );
      this.version = await td3.send( td3.Send.GET_FIRMWARE_VERSION() );
      await td3.send( td3.Send.GET_CONFIGURATION() );
      this.seq = td3;
    } else {
      this.name = "Web";
      this.model = "Audio";
      this.version = "1";
      this.seq = stepseq;
    }

    await this.getPattern();
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
  async onPatternChanged() {
    //console.log( this.pattern );
    //console.log( "are these undefined??", this.pattern.group, this.pattern.section, this.pattern.step_count );
    this.pattern.ties = this.pattern.ties.map( r => 1 )
    if (await td3.isOpen()) {
      await td3.send( td3.Send.SET_PATTERN( this.pattern ) );
      await this.getPattern();
    }
    //console.log( JSON.stringify( this.pattern ) );
  }
  out() {
    console.log( JSON.stringify( this.pattern ) );
  }
  async start() {
    if (await td3.isOpen()) {
      await td3.seqStart( 0x02 /* usb */ )
    } else {
      stepseq.setPattern( this.pattern );
      stepseq.seqStart();
    }
    this.isPlaying = true;
  }
  async stop() {
    if (await td3.isOpen()) {
      await td3.seqStop( 0x00 /* internal */ )
    } else {
      stepseq.seqStop();
    }
    this.isPlaying = false;
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
      //console.log( "after get pattern: " , this.pattern )
    }
  }

  barf = true;
  async tog() {
    this.pattern = await td3.send( td3.Send.GET_PATTERN( this.pattern.group, this.pattern.section ) )
    this.barf = !this.barf
    this.pattern.pitches[4] = this.barf ? 24 : 32
  }

  toggleAccent() {
    if (this.lastStep != -1 && this.lastPitch != -1) {
      this.pattern.accents[this.lastStep] = !this.pattern.accents[this.lastStep];
      this.onPatternChanged();
    }
  }
  toggleSlide() {
    if (this.lastStep != -1 && this.lastPitch != -1) {
      this.pattern.slides[this.lastStep] = !this.pattern.slides[this.lastStep];
      this.onPatternChanged();
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
        this.onPatternChanged();

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

    this.onPatternChanged();
  }

  async onKeyDown( e ) {
    if (e.code=="Space") {
      this.isPlaying ? this.stop() : this.start()
    }
  }

  @HostListener('document:keydown.control.z')
  @HostListener('document:keydown.meta.z')
  undo(event: KeyboardEvent) {
    console.log( "undo!" )
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

  // tap on the left of the button to dec, right of the button to inc.
  onStepsButton(e){
    this.event2xy(e)[0] < (this.event2wh(e)[0]/2) ?
      (this.pattern.step_count = this.pattern.step_count <= 1  ?  1 : this.pattern.step_count - 1) :
      (this.pattern.step_count = 16 <= this.pattern.step_count ? 16 : this.pattern.step_count + 1);
    this.onPatternChanged();
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
    this.onPatternChanged();
  }

  async setSection( s ) {
    this.pattern.section = s;
    await this.getPattern();
  }

  async setGroup( g ) {
    this.pattern.group = g;
    await this.getPattern();
  }
}
