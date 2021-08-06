import { Component, OnInit, NgZone, HostListener } from '@angular/core';
import { Router } from '@angular/router';
import { ElectronService } from '../core/services/electron/electron.service';
import * as td3 from '../../../app/td3';
import * as stepseq from '../../../app/stepseq';
@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {

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
  openPort( e ) {
    console.log( "openPort", e.target.value );
    //await td3.open( e );
  }
  async init() {
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

  async sectionChange(e) {
    this.pattern.section = parseInt( e.target.value )
    console.log( "section", this.pattern.section )
    await this.getPattern();
  }
  async groupChange(e) {
    this.pattern.group = parseInt( e.target.value )
    console.log( "group", this.pattern.group )
    await this.getPattern();
  }
  async stepCountChange(e) {
    this.pattern.step_count = parseInt( e.target.value )
    console.log( "step_count", this.pattern.step_count )
    this.onPatternChanged();
  }
  async onPatternChanged() {
    console.log( this.pattern );
    console.log( "are these undefined??", this.pattern.group, this.pattern.section, this.pattern.step_count );
    this.pattern.ties = this.pattern.ties.map( r => 1 )
    if (await td3.isOpen()) {
      await td3.send( td3.Send.SET_PATTERN( this.pattern ) );
      await this.getPattern();
    }
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

  async incPitch( event, i ) {
    //console.log( event);
    //console.log( "shiftKey", event.shiftKey, "ctrlKey", event.ctrlKey, "altKey", event.altKey, "metaKey", event.metaKey )
    if (event.shiftKey)
      this.pattern.pitches[i] += 1;
    else if (event.ctrlKey) {
      this.pattern.rests[i] = !this.pattern.rests[i];
      if (this.pattern.rests[i] == 0)
        this.pattern.pitches[i] = 0x18
    }
    else if (event.altKey)
      this.pattern.accents[i] = !this.pattern.accents[i];
    else if (event.metaKey)
      this.pattern.slides[i] = !this.pattern.slides[i];
    else
      this.pattern.pitches[i] -= 1;
    
    this.onPatternChanged();
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


}
