# SubatomicTD3ditor - an Editor/Programmer for the Behringer TD3 running on Raspberry Pi Touchscreen

A standalone pattern editor for the Behringer TD3.
- Dedicated Hardware Appliance w/ Touchscreen Display (Raspberry Pi based, Resilient read-only file system)
- Software app  (MacOS, Win, Linux).
- Written in Angular (12) and NodeJS (14), packaged into an Electron (13) application.

![screenshot](screenshot.jpg)

# Status:
  - editor/programmer works/tested on:
    - MacOS MacBookPro 2019 (Catalina 10.15.7)
    - Raspberry Pi (8gb) with [official 7" touchscreen](https://www.raspberrypi.org/products/raspberry-pi-touch-display/)  ([Buster 2021-05-07](https://downloads.raspberrypi.org/raspios_armhf/images/raspios_armhf-2021-05-28/))
    - ...all tests with USB-midi to the TD-3

# Install
Grab a package from the [releases](https://github.com/subatomicglue/behringer-td3-editor/releases) and install it on your OS...

# Source
- The development harness auto-detects frontend code changes (`src/*`) and rebuilds automatically.
- For backend code changes (`app/main.ts`) `ctrl-c` and rerun `npm start`.
```
$ git clone https://github.com/subatomicglue/behringer-td3-editor.git
$ npm install
$ npm start
```

# Installer Packages
### MacOS
```
$  npm run electron:build
$  cd release
$  ls
SubatomicTD3ditor-10.1.1.dmg   mac
$ cd mac
$ ls
SubatomicTD3ditor.app
$ open SubatomicTD3ditor.app
```

### RaspberryPi
```
# on your development computer, we have a command for quickly copying over the changed files to the rpi:
$  npm run deploy-rpi    # which will give you the next commands to run on the rpi:

# on the rpi:
$  cd ~/td3
$  npm install
$  npm run electron:buildrpi
$  DISPLAY=:0.0 release/linux-armv7l-unpacked/subatomictd3ditor
```

# TODO, Future work:
  - SAVE/LOAD patterns to disk
  - rPI needs some polish
    - **Performance:**   UI can be a little slow, maybe because weak rPI combined with Angular (we could try SolidJS or vanilla Javascript to get more lean).
    - **Install Scripts:** rPI build/installation is automated, but the scripts are not available here...  yet.  (less important if we can publish pre-built packages for download)
  - MIDI needs some polish
    - Currently we search for the "TD-3" midi device, if found, use it!   That works for USB MIDI.  It's a little hard coded.
    - I'd like to provide an option in the UI to select the MIDI device in case using a standard midi cable.
  - MIDI interface is on the nodejs side, using the RtMIDI c++ libs, it could be interesting to also provide a Web MIDI implementation as well for a completely browser based solution, avoid all the RPC calls from the Electron Renderer to Node side..
    - Having midi on nodejs side might be more performant for the sequencer timing, since it operates in a separate thread from the renderer, no competition might be better - considering javascript's single thread model.
  - Longer patterns than 16 steps...
    - Would love to program TRACKs into the td3...  we dont have the midi spec to do this, if you know, please open an issue to discuss!
    - We rely on the td3 sequencer, which is limited by 16 steps.  so, maybe some opportunity to implement the sequencer in software, so we can have more flexibility in number of steps.

