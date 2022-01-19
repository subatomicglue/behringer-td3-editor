import { app, BrowserWindow, screen, ipcMain, globalShortcut, Menu } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as url from 'url';
import * as isPi from 'detect-rpi'; // detect raspberry pi
import * as td3 from './td3';
td3.useNode( require('midi') );

// Initialize remote module
require('@electron/remote/main').initialize();

const env = process.env.NODE_ENV || 'development';
let VERBOSE = env != 'development' ? false : true;
console.log( `\n` );
console.log( `[main.ts] -----------------------------------------` );
console.log( `[main.ts] environment = ${env}, VERBOSE=${VERBOSE}` )

function mkdir( dir ) {
  if (!fs.existsSync(dir)){
    VERBOSE && console.log( `[mkdir] creating directory ${dir}` )
    fs.mkdirSync(dir, { recursive: true });
  }
}
// check the directory for write abilities
function dirIsGood( dir ) {
  return fs.existsSync( dir ) && checkPermissions( dir, fs.constants.R_OK | fs.constants.W_OK )
}
function getPlatform() {
  return isPi() ? "pi" : process.platform;
}
function getUserDir( name ) {
  const appname = name;
  const dotappname = "." + name;
  // every path in the checklist needs to point to an app subfolder e.g. /subatomic3ditor,
  let checklist = {
    "pi": [
      path.join( "/media/pi/USB", appname ),
      path.join( "/media/pi/SDCARD", appname ),
      path.join( process.env.HOME, "Documents", appname ),
      path.join( process.env.HOME, "Downloads", appname ),
      path.join( process.env.HOME, "Desktop", appname ),
      path.join( process.env.HOME, dotappname )
    ],
    "darwin": [
      path.join( process.env.HOME, "Documents", appname ),
      path.join( process.env.HOME, "Downloads", appname ),
      path.join( process.env.HOME, "Desktop", appname ),
      path.join( process.env.HOME, dotappname )
    ],
    "win32": [
      path.join( process.env.HOME, "Documents", appname ),
      path.join( process.env.HOME, "Downloads", appname ),
      path.join( process.env.HOME, "Desktop", appname ),
      path.join( process.env.HOME, "AppData", appname ),
      path.join( process.env.HOME, dotappname )
    ],
    "linux": [
      path.join( process.env.HOME, "Documents", appname ),
      path.join( process.env.HOME, "Downloads", appname ),
      path.join( process.env.HOME, "Desktop", appname ),
      path.join( process.env.HOME, dotappname )
    ],
    "unknown": [
      path.join( process.env.HOME, "Documents", appname ),
      path.join( process.env.HOME, "Downloads", appname ),
      path.join( process.env.HOME, "Desktop", appname ),
      path.join( process.env.HOME, dotappname )
    ],
  }
  let platform = getPlatform();
  let cl = checklist[platform] ? checklist[platform] : checklist["unknown"];
  for (let d of cl) {
    // every path in the checklist points to an app subfolder /${name},
    // so check for the parent dir existing (we dont want to create Documents on a system that doesn't have it!)
    let onelevelup = d.replace( /[\\/][^\\/]+$/, "" )
    VERBOSE && console.log( `[getUserDir] checking "${d}", "${onelevelup}" == ${dirIsGood( onelevelup )}` )
    if (dirIsGood( onelevelup )) {
      mkdir( d );
      return d;
    }
  }
  VERBOSE && console.log( `[getUserDir] ERROR: no user directory found on this "${platform}" system!  After checking through these options: `, cl );
  return undefined;
}

let userdir = getUserDir( "subatomic3ditor" );

let win: BrowserWindow = null;
const args = process.argv.slice(1),
  serve = args.some(val => val === '--serve');

function makeMenu() {
let template: Electron.MenuItemConstructorOptions[] = [
  {
    label: getPlatform() !== 'pi' ? 'Electron' : 'File',
    submenu: [
      { role: 'quit' },
    ]
  },
  {
    label: 'Edit',
    submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { role: 'forceReload'},
        { role: 'toggleDevTools'},
    ]
  },
  { role: 'window', submenu: [{ role: 'minimize' }, { role: 'close' }] },
  {
      role: 'help',
      submenu: [{
          label: 'Learn More',
          click() {                           require('electron').shell.openExternal('https://electron.atom.io');
          }
      }]
  }
];
return template;
}

const menu = Menu.buildFromTemplate(makeMenu());

function consoleLogIPC( module, funcname, FUNC, values, result ) {
  let result_str = result === undefined ? "undefined" : JSON.stringify( result );
  let limit = 10;
  VERBOSE && console.log( `[${module}] ${funcname}.${FUNC}(${values.length>0?' ':''}${values.map(r=>typeof r == "string" ? `"${r}"` : r).join(", ")}${values.length>0?' ':''})`, result_str.length <= limit ? `=> ${result_str}` : '' )
  VERBOSE && result_str.length > limit && console.log( `       <= ${JSON.stringify( result )}` )
}

// one renderer binding to rule all of td3...
// call it from the renderer like so:
//   let result = await this.electronService.ipcRenderer.invoke( 'td3', 'setBpm', bpm );
ipcMain.handle('td3', async (event, FUNC, ...values) => {
  let result = td3.hasOwnProperty( FUNC ) ? await td3[FUNC](...values) : `ERROR: no such function as td3.${FUNC}(...)`;
  consoleLogIPC( "main.ts", "td3", FUNC, values, result );
  return result;
})

// call it from the renderer like so:
//   let result = await this.electronService.ipcRenderer.invoke( 'exit' );
ipcMain.handle('exit', async (event, ...values) => {
  VERBOSE && console.log( `[main.ts] exit( ${values.join(", ")} )` )
  process.exit(0);
  return 0;
})

// call it from the renderer like so:
//   let result = await this.electronService.ipcRenderer.invoke( 'save', filename, data );
ipcMain.handle('save', async (event, filename, data) => {
  VERBOSE && console.log( `[main.ts] save( "${path.join( userdir, filename )}", data )` )
  fs.writeFileSync( path.join( userdir, filename ), data, 'utf8' );
  return 0;
})

// call it from the renderer like so:
//   let result = await this.electronService.ipcRenderer.invoke( 'load', filename );
ipcMain.handle('load', async (event, filename) => {
  VERBOSE && console.log( `[main.ts] load( "${path.join( userdir, filename )}" )` )
  if (fs.existsSync( path.join( userdir, filename ) )) {
    return fs.readFileSync( path.join( userdir, filename ), 'utf8' );
  }
  return undefined;
})

//////////////////////////////////////////////////////////////////////////

function createWindow(): BrowserWindow {
  const electronScreen = screen;
  const size = electronScreen.getPrimaryDisplay().workAreaSize;

  // Create the browser window.
  win = new BrowserWindow({
    frame: false,
    resizable: getPlatform() !== "pi", // we can resize on lin/win/mac,  but no resize on raspberry pi (which is linux)
    x: 0,
    y: 0,
    width: size.width,
    height: size.height,
    webPreferences: {
      //devTools: false,
      nodeIntegration: true,
      allowRunningInsecureContent: (serve) ? true : false,
      contextIsolation: false,  // false if you want to run e2e test with Spectron
      enableRemoteModule : true // true if you want to run e2e test with Spectron or use remote module in renderer context (ie. Angular)
    },
  });



  if (serve) {
    win.webContents.openDevTools();
    win.loadURL('http://localhost:4200');
  } else {
    // Path when running electron executable
    let pathIndex = './index.html';

    if (fs.existsSync(path.join(__dirname, '../dist/index.html'))) {
       // Path when running electron in local folder
      pathIndex = '../dist/index.html';
    }

    win.loadURL(url.format({
      pathname: path.join(__dirname, pathIndex),
      protocol: 'file:',
      slashes: true
    }));

    // td3.setHandler( (code, value, code_str) => {
    //   win.webContents.send( 'handler', code_str, value );
    // })

    //win.removeMenu();
  }

  // Emitted when the window is closed.
  win.on('closed', () => {
    console.log( `[main.ts] win 'closed'` )
    // Dereference the window object, usually you would store window
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    win = null;
  });

  return win;
}

// fs.accessSync is so close, yet just not there.   Make it return true/false:
function checkPermissions( file, perms ) {
  try {
    fs.accessSync(file, perms);
    return true;
  } catch (err) {
    return false;
  }
};

try {
  // switch electron userData path to the userdir, on the pi we run RO filesys, so this will give us RW localStorage as well.
  app.setPath( 'userData', userdir );

  // This method will be called when Electron has finished
  // initialization and is ready to create browser windows.
  // Some APIs can only be used after this event occurs.
  // Added 400 ms to fix the black background issue while using transparent window. More detais at https://github.com/electron/electron/issues/15947
  app.on('ready', () => {
    setTimeout(createWindow, 400)
    //Menu.setApplicationMenu(menu);

    let os = require('os');
    console.log( "[main.ts] app 'ready':  Happy Announcement:    HELLO, I Exist!" )
    console.log( "[main.ts] app 'ready':  OS Type:", os.type() ); // "Windows_NT"
    console.log( "[main.ts] app 'ready':  OS Release:", os.release() ); // "10.0.14393"
    console.log( "[main.ts] app 'ready':  OS Platform:", os.platform() ); // "win32"
  });

  /*
  app.on('ready', () => {
    // Register a shortcut listener for Ctrl + Shift + I
    globalShortcut.register('Control+Shift+I', () => {
        // When the user presses Ctrl + Shift + I, this function will get called
        // You can modify this function to do other things, but if you just want
        // to disable the shortcut, you can just return false
        return false;
    });
  });
  */

  // Quit when all windows are closed.
  app.on('window-all-closed', () => {
    console.log( "[main.ts] app 'window-all-closed'" );
    // On OS X it is common (but really old convention that's antiquated) for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    //if (process.platform !== 'darwin') {
      console.log( "[main.ts] app 'window-all-closed': app.quit()" );
      app.quit();
    //}
  });

  app.on('will-quit', () => {
    console.log( "[main.ts] app 'will-quit'" );
    // On OS X it is common (but really old convention that's antiquated) for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    //if (process.platform !== 'darwin') {
      VERBOSE && console.log( "[main.ts] app 'will-quit': app.quit()" );
      app.quit();
      VERBOSE && console.log( "[main.ts] app 'will-quit': app.exit(0)" );
      app.exit(0);
    //}
  });

  process.on('beforeExit', (code) => {
    console.log( "[main.ts] app 'beforeExit'", code )
    if (code) {
      VERBOSE && console.log( `[main.ts] app 'beforeExit': process.exit( ${code} )` );
      process.exit(code);
    }
   });


  app.on('activate', () => {
    console.log( `[main.ts] app 'activate'` );
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (win === null) {
      createWindow();
    }
  });

} catch (e) {
  console.log( `[main.ts] catch(${e}) { throw ${e} }` );
  // Catch Error
  throw e;
}
