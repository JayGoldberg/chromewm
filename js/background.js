/**
 * @fileoverview Background file
 * @author EduCampi
 */

goog.provide('chromewm.background');

goog.require('goog.array');
goog.require('goog.object');
goog.require('goog.string');

const DEBUG = false; // Logs Method calls.
const DEBUG2 = true; // Logs data changes.

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

/** @type {Array} workspaces */
/**
* @desc Initializes the Main object
*/
chromewm.background.prototype.init = function() {
  /** Initializes properties */
  this.currentWorkspace = 0;
  this.maxWorkspaces = 3;

  /** Initializes Listeners */
  chrome.commands.onCommand.addListener( (command) => {
      this.handleCommand(command);
    });
}


/**
 * @desc Populates this.workspaces with windows in currentWorkspace
 * @return {Promise}
*/
chromewm.background.prototype.getWorkspaceWindows = function() {
  return new Promise((resolve, reject) => {
    chrome.windows.getAll((windows_) => {
      goog.array.forEach((windows_), (window_,i,a) => {
        if (!goog.array.find(this.windows, (w,i,a) => {
            return w.id == window_.id;})) {
          this.windows.push({
            id: window_.id,
            state: window_.state,
            workspace: this.currentWorkspace
          });
        }
      });
      DEBUG2 && console.log("DATA: getWorkspaceWindows:", this.windows);
      resolve();
    });
  });
}


/**
 * @desc Switches to new workspace
 * @param {string} command
*/
//TODO(): Provide visual feedback when changing workspaces
chromewm.background.prototype.switchWorkspace = function(command) {
  var newWorkspace = this.currentWorkspace;
  if (command == "ws-next" && this.currentWorkspace != this.maxWorkspaces-1) {
    newWorkspace = this.currentWorkspace + 1;
  } else if (command == "ws-prev" && this.currentWorkspace != 0) {
    newWorkspace = this.currentWorkspace - 1;
  }

  if (newWorkspace != this.currentWorkspace) {

    this.getWorkspaceWindows().then( () => {
      this.getThisWindowsByWorkspace(this.currentWorkspace).then((windows_) => {
        DEBUG2 && console.log('Leaving Workspace:', this.currentWorkspace);
        DEBUG2 && console.log('Hiding windows ', windows_);
        goog.array.forEach(windows_, (window_,i,a) => {
          chrome.windows.update(window_.id, {state: 'minimized'});
        });
      });

//TODO(): Maybe I need to open a new window, to keep listening for keyboard
//TODO(): Should I track which one was in focus to ensure I open it the last?
      this.getThisWindowsByWorkspace(newWorkspace).then((windows_) => {
        DEBUG2 && console.log('Entering Workspace:', newWorkspace);
        DEBUG2 && console.log('Showing windows ', windows_);
        if (goog.array.isEmpty(windows_)) {
          chrome.windows.create({state: 'maximized'});
        } else {
          goog.array.forEach(windows_, (window_,i,a) => {
            if (window_.state != "minimized") {
              chrome.windows.update(window_.id, {focused: true});
            }
          });
        }
      });

    }).then( () => {
      this.currentWorkspace = newWorkspace;
      chrome.notifications.create({
          type: "basic",
          title: "Workspace "+newWorkspace,
          priority: 2
        });
      //     },
      //     (notificationId_) => {
      //       setTimeout(
      //         () => {chrome.notifications.clear(notificationId_);}, 1000);
      // });
    });
  }
}


/**
 * @desc Returns all windows from this.windows in the provided workspace
 * @param {number} workspace - The workspace number
 * @return {Promise}
*/
chromewm.background.prototype.getThisWindowsByWorkspace = function(workspace) {
  var tempArray = [];
  return new Promise((resolve, reject) => {
    tempArray = goog.array.filter(this.windows, (e,i,a) => {
        return e.workspace == workspace;
      });
    if (tempArray.lenght != 0) {
      resolve(tempArray);
    } else {
      reject();
    }
  });
}


/** DONE
* @desc Gets the display's work area where the window is.
* @param {!number} windowId
* @return {Promise}
*/
chromewm.background.prototype.getDisplayWorkArea = function (windowId) {
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
  DEBUG && console.log('INFO: background.tileWindow(',movement,')');
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

      DEBUG2 && console.log('DATA: background.tileWindow: ',
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
  DEBUG && console.log('INFO: background.handleCommand(',command,')');
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
 * Create and start extension
*/
/** @type {chromewm.background} backgroundMain */
var backgroundMain = new chromewm.background();
backgroundMain.init();
