import { app, BrowserWindow, screen, ipcMain, globalShortcut, Menu } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as url from 'url';
import * as isPi from 'detect-rpi'; // detect raspberry pi
import * as td3 from './td3';
td3.useNode( require('midi') );

const env = process.env.NODE_ENV || 'development';
console.log( `\n[main.ts] environment = ${env}`)

// Initialize remote module
require('@electron/remote/main').initialize();

let VERBOSE = false;

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
function getUserDir() {
  const appname = "subatomic3ditor";
  const dotappname = ".subatomic3ditor";
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
    // every path in the checklist points to an app subfolder /subatomic3ditor,
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
let userdir = getUserDir();

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

// one renderer binding to rule all of td3...
// call it from the renderer like so:
//   let result = await this.electronService.ipcRenderer.invoke( 'td3', 'setBpm', bpm );
ipcMain.handle('td3', async (event, FUNC, ...values) => {
  VERBOSE && console.log( `[main.ts] td3.${FUNC}( ${values.join(", ")} )` )
  let result = td3.hasOwnProperty( FUNC ) ? await td3[FUNC](...values) : `ERROR: no such function as td3.${FUNC}(...)`;
  VERBOSE && console.log( `       <= ${JSON.stringify( result )}` )
  return result;
})

// one renderer binding to rule all of td3...
// call it from the renderer like so:
//   let result = await this.electronService.ipcRenderer.invoke( 'td3', 'setBpm', bpm );
ipcMain.handle('exit', async (event, ...values) => {
  VERBOSE && console.log( `[main.ts] exit( ${values.join(", ")} )` )
  process.exit(0);
  return 0;
})

ipcMain.handle('save', async (event, filename, data) => {
  VERBOSE && console.log( `[main.ts] save( "${path.join( userdir, filename )}", data )` )
  fs.writeFileSync( path.join( userdir, filename ), data, 'utf8' );
  return 0;
})
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
    require('electron-reload')(__dirname, {
      electron: require(path.join(__dirname, '/../node_modules/electron'))
    });
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
    console.log( "\n----------------------------------------\nHappy Announcement:    HELLO, I Exist!" )
    console.log( "OS Type:", os.type() ); // "Windows_NT"
    console.log( "OS Release:", os.release() ); // "10.0.14393"
    console.log( "OS Platform:", os.platform() ); // "win32"
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
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    //if (process.platform !== 'darwin') {
      app.quit();
    //}
  });

  app.on('will-quit', () => {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    //if (process.platform !== 'darwin') {
      app.quit();
      console.log( "will quit" )
      app.exit(0);
      //process.exit(-1);
    //}
  });

  process.on('beforeExit', (code) => {
    console.log( "beforeExit", code )
    if (code) {
     process.exit(code);
    }
   });


  app.on('activate', () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (win === null) {
      createWindow();
    }
  });

} catch (e) {
  // Catch Error
  // throw e;
}
