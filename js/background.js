/**
 * @fileoverview Background file
 * @author EduCampi
 */

// TODO(): Implement Promises properly, resolve and reject
// TODO(): Cleanup and improve code quality
// TODO(): Move windows to other workspaces

goog.provide('chromewm.background');

goog.require('goog.array');
// goog.require('goog.events');
goog.require('goog.object');
goog.require('goog.storage.mechanism.HTML5LocalStorage');
goog.require('goog.string');


var DEBUG_CALLS = false; // Logs Method calls.
var DEBUG_VARS = false; // Logs data changes.
var DEBUG_TILING = false; // Logs window tiling
var DEBUG_DEV = true; // Extra flag to use during dev efforts


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
  /** @private {Object} storage_ */
  this.storage_;
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
    }, 500);
  });
}


/**
* @desc Initializes the Main object
*/
//TODO(): Restore saved this.windows ?
chromewm.background.prototype.Init = async function() {
  /** Initializes properties */
  this.currentWorkspace = 1;

  this.storage_ = new goog.storage.mechanism.HTML5LocalStorage();

  this.maxWorkspaces = parseInt(this.storage_.get('workspaceQty_'),10) || 1;

  // Waits for Windows to reload after a Chrome crash.
  var waitW = await this.waitForWindows();
  DEBUG_DEV && console.log('INIT: Found Windows', waitW);

  // Recovers saved Windows and Workspaces and shows workspace 1
  this.getWindowsFromStorage().then(savedWindows_ => {
    chrome.windows.getAll({'populate': true}, (windows_) => {
      goog.array.forEach(windows_, (window_,i,a) => {
        goog.array.forEach(savedWindows_, (sW_, sI, sA) => {

          if (sW_.tabs == goog.string.hashCode(window_.tabs.length.toString() +
              goog.array.last(window_.tabs).url)) {

            this.windows.push({
              id: window_.id,
              state: sW_.state,
              focused: window_.focused,
              tabs: sW_.tabs,
              workspace: sW_.workspace
            });
            //TODO():Replace by this.showWorkspace_()
            //TODO():Update local storage (remove old, add new)
            if (sW_.workspace == 1) {
              chrome.windows.update(window_.id, {focused: true});
            } else {
              chrome.windows.update(window_.id, {state: 'minimized'});
            }
          }
        });
      });
      console.log('INIT this.windows', this.windows);
      console.log('INIT windows_', windows_);
    });
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


/**
 * @desc Gets Windows from localStorage
 * @return {Promise}
 */
chromewm.background.prototype.getWindowsFromStorage = function() {
  return new Promise((resolve, reject) => {
    var storageIterator = this.storage_.__iterator__(true);
    var windows_ = [];
    var prefixNumber, windowId;

    while (true) {
      try{
        prefixNumber = goog.string.parseInt(storageIterator.next(true));
        if (!isNaN(prefixNumber) && prefixNumber != windowId) {
          windowId = prefixNumber.toString();
          goog.array.insert(windows_, {
            id: prefixNumber,
            focused: this.storage_.get(windowId + '-focused'),
            state: this.storage_.get(windowId + '-state'),
            tabs: this.storage_.get(windowId + '-tabs'),
            workspace: this.storage_.get(windowId + '-ws')
          });
        }
      }
      catch(err) {
        break;
      }
    }
    if (windows_.length > 0) {
      resolve(windows_);
    } else {
      reject();
    }
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
    chrome.windows.getAll({'populate': true}, (windows_) => {
      DEBUG_VARS && console.log('DATA: getWorkspaceWindows currentWindows:', windows_);

      // Removes closed windows from this.windows
      goog.array.removeAllIf(this.windows, (thisWindow_,i,a) => {
        var foundWindow = goog.array.find(windows_, (w,i,a) => {
            return w.id == thisWindow_.id;});

        if (!foundWindow) {
          this.removeWindowFromStorage_(thisWindow_.id);
          return true;
        }
        return false;
      });

      // Adds new windows_ to this.windows
      // TODO(): Replace by goog.array.map ?
      // TODO(): Update this.windows_ if tabs lenght and last url changed
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
            focused: window_.focused,
            id: window_.id,
            state: window_.state,
            tabs: goog.string.hashCode(
                window_.tabs.length.toString() +
                goog.array.last(window_.tabs).url),
            workspace: currentWorkspace
          });

          //TODO(): Deber'ia guardar solo cuando me voy del workspace?
          this.saveLocally_({
            [window_.id.toString() + '-focused']: window_.focused,
            [window_.id.toString() + '-state']: window_.state,
            [window_.id.toString() + '-tabs']: goog.string.hashCode(
                window_.tabs.length.toString() +
                goog.array.last(window_.tabs).url),
            [window_.id.toString() + '-ws']: currentWorkspace
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
 * @desc Shows the specified workspace
 * @private
 * @param {!number} newWorkspace
 */
chromewm.background.prototype.showWorkspace_ = function(newWorkspace) {
  if (!(newWorkspace >= 1 && newWorkspace <= this.maxWorkspaces)) {
    return;
  }
  var newWindowHash = goog.string.hashCode('1' + 'chrome://newtab/');
  var windowIdInFocus;

  this.getWorkspaceWindows().then( () => {

    goog.array.forEach(this.windows, (window_,i,a) => {
      if (window_.workspace == this.currentWorkspace) {
        console.log('HIDING:',window_);
        if (window_.tabs == newWindowHash) {
          chrome.windows.remove(window_.id);
          goog.array.remove(this.windows, window_);
          this.removeWindowFromStorage_(window_.id);
        } else {
          chrome.windows.update(window_.id, {state: 'minimized'});
        }

      } else if (window_.workspace == newWorkspace) {
        console.log('SHOWING:',window_);
        chrome.windows.update(window_.id, {focused: true});
        if (window_.focused) {
          windowIdInFocus = window_.id;
        }
      }
    });
    console.log('windowIdInFocus', windowIdInFocus);
    if (typeof windowIdInFocus === 'undefined') {
      chrome.windows.create({url: "chrome://newtab/", state: 'maximized'});
    } else {
      chrome.windows.update(windowIdInFocus, {focused: true});
    }
    console.log('UPDATING this.workspace');
    this.currentWorkspace = newWorkspace;
    this.showWsTransition(newWorkspace);
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
    this.showWorkspace_(newWorkspace);
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
 * @desc Removes a window from the local Storage (this.storage_)
 * @private
 * @param {!number} windowId
 */
chromewm.background.prototype.removeWindowFromStorage_ = function(windowId) {
  var windowIdStr = windowId.toString();
  this.storage_.remove(windowIdStr + '-focused');
  this.storage_.remove(windowIdStr + '-state');
  this.storage_.remove(windowIdStr + '-tabs');
  this.storage_.remove(windowIdStr + '-ws');
}


/**
 * @desc Saves an object in the local storage
 * @private
 * @param {!Object} objectToSave
 */
chromewm.background.prototype.saveLocally_ = function(objectToSave) {
  DEBUG_DEV && console.log('INFO: saveLocally_ saving:', objectToSave);
  goog.object.forEach(objectToSave || [], (value_,key_,object_) => {
    this.storage_.set(key_, value_);
  });
}


/**
 * Create and start extension
 */
/** @type {chromewm.background} backgroundMain */
var backgroundMain = new chromewm.background();
backgroundMain.Init();
