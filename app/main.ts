import { app, BrowserWindow, screen, ipcMain, globalShortcut, Menu } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as url from 'url';

import * as td3 from './td3';
td3.useNode( require('midi') );

// Initialize remote module
require('@electron/remote/main').initialize();


let win: BrowserWindow = null;
const args = process.argv.slice(1),
  serve = args.some(val => val === '--serve');

function makeMenu() {
let template: Electron.MenuItemConstructorOptions[] = [
  {
    label: process.platform === 'darwin' ? 'Electron' : 'File',
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
  console.log( `[main.ts] td3.${FUNC}( ${values.join(", ")} )` )
  let result = td3.hasOwnProperty( FUNC ) ? await td3[FUNC](...values) : `ERROR: no such function as td3.${FUNC}(...)`;
  console.log( `       <= ${JSON.stringify( result )}` )
  return result;
})

// one renderer binding to rule all of td3...
// call it from the renderer like so:
//   let result = await this.electronService.ipcRenderer.invoke( 'td3', 'setBpm', bpm );
ipcMain.handle('exit', async (event, ...values) => {
  console.log( `[main.ts] exit( ${values.join(", ")} )` )
  process.exit(0);
  return 0;
})

//////////////////////////////////////////////////////////////////////////

function createWindow(): BrowserWindow {
  const electronScreen = screen;
  const size = electronScreen.getPrimaryDisplay().workAreaSize;

  // Create the browser window.
  win = new BrowserWindow({
    frame: false,
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

try {
  // This method will be called when Electron has finished
  // initialization and is ready to create browser windows.
  // Some APIs can only be used after this event occurs.
  // Added 400 ms to fix the black background issue while using transparent window. More detais at https://github.com/electron/electron/issues/15947
  app.on('ready', () => {
    setTimeout(createWindow, 400)
    //Menu.setApplicationMenu(menu);
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
      //app.quit();
      console.log( "will quit" )
      //app.exit(0);
    //}
  });

  process.on('beforeExit', (code) => {
    console.log( "beforeExit" )
    if (code) {
     //process.exit(code);
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
