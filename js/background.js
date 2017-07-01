/**
 * @fileoverview Background file
 * @author EduCampi
*/

// TODO(): Implement Promises properly, resolve and reject
// TODO(): Cleanup and improve code quality

goog.provide('chromewm.background');

goog.require('goog.array');
goog.require('goog.object');
goog.require('goog.string');

const DEBUG = true; // Logs Method calls.
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


/**
* @desc Initializes the Main object
*/

//TODO(): getOptions
//TODO(): Restore saved this.windows ?
chromewm.background.prototype.init = function() {
  /** Initializes properties */
  this.currentWorkspace = 1;
  this.maxWorkspaces = 3;

  /** Initializes Listeners */
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
  return new Promise((resolve, reject) => {
    chrome.windows.getAll((windows_) => {

      // Removes closed windows from this.windows
      goog.array.removeAllIf(this.windows, (window_,i,a) => {
        if (!goog.array.find(windows_, (w,i,a) => {
            return w.id == window_.id;})) {
          return true;
        } else {
          return false;
        }
      });

      // Adds new windows_ to this.windows
      goog.array.forEach(windows_, async (window_,i,a) => {
        var foundWindow = await goog.array.find(this.windows, (w,i,a) => {
          return w.id == window_.id;});
        DEBUG2 && console.log('DATA: window_', window_);
        DEBUG2 && console.log('DATA: foundWwindow', foundWindow);
        if (foundWindow) {
          await goog.array.removeIf(this.windows, (w, i, a ) => {
            return (foundWindow.focused != w.focused) &&
                (foundWindow.workspace == currentWorkspace);
          });
        }
        if (!foundWindow) {
            //if (!goog.array.find(this.windows, (w,i,a) => {
            // return w.id == window_.id;})) {

          this.windows.push({
            id: window_.id,
            state: window_.state,
            focused: window_.focused,
            workspace: currentWorkspace
          });
        }
      });
      DEBUG2 && console.log("DATA: getWorkspaceWindows this.windows:",
          this.windows);
      resolve();
    });
  });
}


/**
 * @desc Switches to new workspace
 * @param {string} command
*/

//TODO(): Close the window if empty when leaving workspace (needs Tabs permissions)
//TODO(): Track which one was in focus to ensure I open it the last
chromewm.background.prototype.switchWorkspace = function(command) {
  var newWorkspace = this.currentWorkspace;
  if (command == "ws-next" && this.currentWorkspace != this.maxWorkspaces) {
    newWorkspace = this.currentWorkspace + 1;
  } else if (command == "ws-prev" && this.currentWorkspace != 1) {
    newWorkspace = this.currentWorkspace - 1;
  }

  if (newWorkspace != this.currentWorkspace) {
    var windowIdOnFocus = {};

    this.getWorkspaceWindows().then( () => {

      // Hides currentWorkspace windows
      this.getThisWindowsByWorkspace(this.currentWorkspace).then((windows_) => {
        DEBUG2 && console.log('Hiding windows ', windows_);
        goog.array.forEach(windows_, (window_,i,a) => {

          chrome.windows.update(window_.id, {state: 'minimized'});
        });
      });

      // Shows newWorkspace windows
      this.getThisWindowsByWorkspace(newWorkspace).then(async (windows_) => {
        DEBUG2 && console.log('Showing windows ', windows_);
        if (goog.array.isEmpty(windows_)) {
          chrome.windows.create({state: 'maximized'});
        } else {
          await goog.array.forEach(windows_, (window_,i,a) => {
            if (window_.state != "minimized") {
              chrome.windows.update(window_.id, {focused: true});
              if (window_.focused) {
                windowIdOnFocus = window_.id;
                DEBUG2 && console.log("DATA: windowIdOnFocus", windowIdOnFocus);
              }
            }
          });
          chrome.windows.update(windowIdOnFocus, {focused: true});
        }
      });
    }).then( () => {
      this.currentWorkspace = newWorkspace;
      this.showWsTransition(newWorkspace);
    });
  }
}


/** TODO(): Use workspace icon for notification?
 * @desc Provides visual feedback to user on workspace change
 * @param {number} newWorkspace
*/
chromewm.background.prototype.showWsTransition = function(newWorkspace) {
  chrome.notifications.create("workspaceChange", {
      type: "basic",
      title: "\rWorkspace " + newWorkspace,
      message: "",
      iconUrl: "icon-128.png",
      priority: 2
      },
      (notificationId_) => {
        setTimeout(() => {
          chrome.notifications.clear(notificationId_);}, 700);
  });

  chrome.browserAction.setIcon({
    path: "browser-38-" + newWorkspace + ".png"
  });
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


/**
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
