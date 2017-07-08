/**
 * @fileoverview Background file
 * @author EduCampi
*/

// TODO(): Implement Promises properly, resolve and reject
// TODO(): Cleanup and improve code quality
// TODO(): Move windows to other workspaces
// TODO(): Recover workspaces on Chrome crash or powercycle.

goog.provide('chromewm.background');

goog.require('goog.array');
// goog.require('goog.events');
goog.require('goog.object');
goog.require('goog.string');

var DEBUG_CALLS = false; // Logs Method calls.
var DEBUG_VARS = false; // Logs data changes.
var DEBUG_TILING = false; // Logs window tiling
var DEBUG_DEV = true; // Extra flag to use during dev efforts

/**
 * Create and start extension
*/
/** @type {chromewm.background} backgroundMain */
var backgroundMain = new chromewm.background();
backgroundMain.Init();


/**
 * @desc Defines main object
 * @constructor @export
 */
chromewm.background = function() {
  /** @type {Array} windows */
  this.windows = [];
  /** @type {number} maxWorkspaces */
  this.maxWorkspaces;
  /** @type {number} currentWorkspace */
  this.currentWorkspace;
}


chromewm.background.prototype.waitForWindows = function() {
  return new Promise(resolve => {
  var timer = setInterval( () => {
      chrome.windows.getAll((windows_) => {
        var largo = windows_.length;
        if (largo > 1) {
          clearInterval(timer);
          resolve(largo);
        }
      });
    }, 1000);
  });
}


/**
* @desc Initializes the Main object
*/
//TODO(): Restore saved this.windows ?
chromewm.background.prototype.Init = async function() {
  /** Initializes properties */
  this.currentWorkspace = 1;

  this.maxWorkspaces = localStorage.getItem('workspaceQty_') || 1;


  var waitW = await this.waitForWindows();
  console.log('Found Windows', waitW);

// it works?.
  chrome.windows.getAll({'populate': true}, (windows_) => {
    goog.array.forEach(windows_, (window_,i,a) => {
      // need to identify what was the old id, in order to get the right state and ws.
      // if hay un 'id' para que local{id+'tabsLength' and id+'lastTabUrl'}
      // son lo mismo que en window_.id? entonces =>

      this.windows.push({
        id: window_.id,
        state: localStorage.getItem(
            window_.id.toString() + 'state') || window_.state,
        focused: window_.focused,
        workspace: localStorage.getItem(window_.id.toString() + 'ws') || 1
      });
    });
    console.log('INIT this.windows', this.windows);
    console.log('INIT windows_', windows_);
    // TODO(): Show Windows in Workspace 1

  });


  //TODO(): replace by goog.events
  /** Initializes Listeners */
  window.addEventListener(
      'storage',
      (e) => {
        console.log('Storage Changed:', e);
        this.maxWorkspaces = e.newValue;
      }
  );

  chrome.commands.onCommand.addListener( (command) => {
      this.handleCommand(command);
    });


}


/** TODO(): Check using goog.array.insert() to add windows
 * @desc Populates this.windows with windows in currentWorkspace
 * @return {Promise}
*/
chromewm.background.prototype.getWorkspaceWindows = function() {
  var currentWorkspace = this.currentWorkspace;
  DEBUG_CALLS && console.log("INFO: IN getWorkspaceWindows (this.windows):",
      this.windows);
  return new Promise((resolve, reject) => {
    chrome.windows.getAll((windows_) => {
      DEBUG_VARS && console.log('DATA: getWorkspaceWindows currentWindows:', windows_);

      // Removes closed windows from this.windows
      goog.array.removeAllIf(this.windows, (thisWindow_,i,a) => {
        var foundWindow = goog.array.find(windows_, (w,i,a) => {
            return w.id == thisWindow_.id;});

        if (!foundWindow) {
          localStorage.removeItem(thisWindow_.id.toString()+'state');
          localStorage.removeItem(thisWindow_.id.toString()+'ws');
          return true;
        }
        return false;
      });

      // Adds new windows_ to this.windows
      // TODO(): Replace by goog.array.map ?
      goog.array.forEach(windows_, (window_,i,a) => {
        var foundWindow = null;
        var foundWindowIndx = goog.array.findIndex(this.windows, (thisWindow_,i,a) => {
             return thisWindow_.id == window_.id;});

        if (foundWindowIndx != -1) { foundWindow = this.windows[foundWindowIndx];}

        if (foundWindow && foundWindow.focused != window_.focused
            && foundWindow.workspace == currentWorkspace) {
          this.windows[foundWindowIndx].focused = window_.focused;
        }

        if(!foundWindow) {
          this.windows.push({
            id: window_.id,
            state: window_.state,
            focused: window_.focused,
            workspace: currentWorkspace
          });

          this.saveLocally_({
            [window_.id.toString() + "state"]: window_.state,
            [window_.id.toString() + "ws"]: currentWorkspace
          });
        }
      });

      DEBUG_CALLS && console.log("INFO: OUT getWorkspaceWindows (this.windows):",
          this.windows);
      resolve();
    });
  });
}


/**
 * @desc Returns all windows from this.windows in the provided workspace
 * @param {number} workspace - The workspace number
 * @return {Promise}
*/
chromewm.background.prototype.getThisWindowsByWorkspace = function(workspace) {
  // var tempArray = [];
  return new Promise((resolve, reject) => {
    resolve(goog.array.filter(this.windows, (window_,i,a) => {
        return window_.workspace == workspace;
        }));
    // if (tempArray.length != 0) {
      // resolve(tempArray);
    // } else {
      // reject([]);
    // }
  });
}


/**
 * @desc Switches to new workspace
 * @param {string} command
*/
chromewm.background.prototype.switchWorkspace = function(command) {
  var newWorkspace = this.currentWorkspace;
  if (command == "ws-next" && this.currentWorkspace != this.maxWorkspaces) {
    newWorkspace = this.currentWorkspace + 1;
  } else if (command == "ws-prev" && this.currentWorkspace != 1) {
    newWorkspace = this.currentWorkspace - 1;
  }

  if (newWorkspace != this.currentWorkspace) {
    var windowIdOnFocus;

    this.getWorkspaceWindows().then( () => {

      // Hides currentWorkspace windows
      this.getThisWindowsByWorkspace(this.currentWorkspace).then((windows_) => {
        DEBUG_VARS && console.log('Hiding windows ', windows_);
        goog.array.forEach(windows_, (window_,i,a) => {
          chrome.windows.get(window_.id, {populate: true}, (w_) => {
            DEBUG_DEV && console.log('TABS:',w_.tabs);
            if (w_.tabs.length == 1 && w_.tabs[0].url == "chrome://newtab/") {
              chrome.windows.remove(w_.id);
              goog.array.remove(this.windows, window_);
            } else {
              chrome.windows.update(window_.id, {state: 'minimized'});
            }
          });
        });
      });

      // Shows newWorkspace windows
      this.getThisWindowsByWorkspace(newWorkspace).then((windows_) => {
        DEBUG_VARS && console.log('Showing windows ', windows_);
        if (goog.array.isEmpty(windows_)) {
          chrome.windows.create({url: "chrome://newtab/", state: 'maximized'});
        } else {
          goog.array.forEach(windows_, (window_,i,a) => {
            // if (window_.state != "minimized") {
              chrome.windows.update(window_.id, {focused: true});
              if (window_.focused) {
                windowIdOnFocus = window_.id;
              }
            // }
          });
          if (windowIdOnFocus) {  // Maybe there's no need to check (always one focused)
            chrome.windows.update(windowIdOnFocus, {focused: true});
          }
        }
      });
    }).then( () => {
      this.currentWorkspace = newWorkspace;
      this.showWsTransition(newWorkspace);
    });
  }
}


/**
 * @desc Provides visual feedback to user on workspace change
 * @param {number} newWorkspace
*/
chromewm.background.prototype.showWsTransition = function(newWorkspace) {
  chrome.notifications.create("workspaceChange", {
      type: "basic",
      title: "\rWorkspace " + newWorkspace,
      message: "",
      iconUrl: "icon-64-" + newWorkspace + ".png",
      priority: 2
      },
      (notificationId_) => {
        setTimeout(() => {
          chrome.notifications.clear(notificationId_);}, 2000);
  });

  chrome.browserAction.setIcon({
    path: "icon-38-" + newWorkspace + ".png"
  });
}


/**
* @desc Gets the display's work area where the window is.
* @param {!number} windowId
* @return {Promise}
*/
chromewm.background.prototype.getDisplayWorkArea = function(windowId) {
  var displayInFocus = {};
  return new Promise((resolve, reject) => {
    chrome.system.display.getInfo( (displays) => {
      chrome.windows.get(windowId, (window_) => {
        displayInFocus = goog.array.find(displays, (display, i, a) => {
          return (window_.left < (display.workArea.left+display.workArea.width))
            && (window_.top < (display.workArea.top + display.workArea.height))
        });
        if (goog.object.containsKey(displayInFocus, 'workArea')) {
          resolve(displayInFocus.workArea)
        } else {
          reject(Error("Failed to getDisplayWorkArea"));
        }
      });
    });
  });
}


/**
 * @desc Tiles window
 * @param {string} movement
 */
chromewm.background.prototype.tileWindow = function(movement) {
  DEBUG_TILING && console.log('INFO: background.tileWindow(',movement,')');
  var newSize = {};
  chrome.windows.getLastFocused((window_) => {
    this.getDisplayWorkArea(window_.id).then((workArea) => {
      var tileSize = {
        height: Math.round(workArea.height/2),
        width: Math.round(workArea.width/2)
      };
      var workAreaCenter = {
        h: workArea.left + tileSize.width,
        v: workArea.top + tileSize.height
      };
      switch(movement) {
        case 'tile-left':
          newSize.left = workArea.left;
          if (window_.left == workAreaCenter.h && window_.width == tileSize.width) {
            newSize.width = workArea.width;
          } else {
            newSize.width = tileSize.width;
          }
          break;
        case 'tile-right':
          if (window_.left == workArea.left && window_.width == tileSize.width) {
            newSize.width = workArea.width;
          } else {
            newSize.left = workAreaCenter.h;
            newSize.width = tileSize.width;
          }
          break;
        case 'tile-up':
          newSize.top = workArea.top;
          if (window_.height == tileSize.height) {
            if (window_.top == workArea.top) {
              newSize = {state: 'maximized'};
            } else if (window_.top == workAreaCenter.v) {
            newSize.height = workArea.height;
            }
          } else {
            newSize.height = tileSize.height;
          }
          break;
        case 'tile-down':
          if (window_.top == workArea.top && window_.height == tileSize.height) {
            newSize.height = workArea.height;
          } else {
            newSize.height = tileSize.height;
            newSize.top = workAreaCenter.v;
          }
          break;
        default:
          console.log('ERROR: Unrecognized command recieved in tileWindow: ',
              movement);
          return;
      };

      DEBUG_TILING && console.log('DATA: background.tileWindow: ',
          'window_:',window_,
          'workArea:', workArea,
          'workAreaCenter:', workAreaCenter,
          'newSize:', newSize
          );

      if (window_.state == 'maximized') {
        chrome.windows.update(window_.id, {state: 'normal'});
      }
      chrome.windows.update(window_.id, newSize);
    });
  });
}


/**
* @desc Handles command recieved
* @param {string} command
*/
chromewm.background.prototype.handleCommand = function(command) {
  DEBUG_CALLS && console.log('INFO: background.handleCommand(',command,')');
  if (goog.string.startsWith(command, 'tile-')) {
    this.tileWindow(command);
    return;
  }
  if (goog.string.startsWith(command, 'ws-')) {
    this.switchWorkspace(command);
    return;
  }
}


/**
 * @desc Saves an object in the local storage
 * @private
 * @param {Object=} objectToSave
 */
chromewm.background.prototype.saveLocally_ = function(objectToSave) {
  DEBUG_DEV && console.log('INFO: saveLocally_ saving:', objectToSave);
  goog.object.forEach(objectToSave, (value_,key_,object_) => {
    localStorage.setItem(key_, value_);
  });
}
