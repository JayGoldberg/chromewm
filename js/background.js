/**
 * @fileoverview Background file
 * @author EduCampi
 */

goog.provide('chromews.background');

goog.require('goog.array');
goog.require('goog.object');
goog.require('goog.string');

const DEBUG = true; // Logs Method calls.
const DEBUG2 = true; // Logs data changes.

/**
 * @desc Defines main object
 * @constructor @export
 */
chromews.background = function() {
  this.workspaces = [[]];
}


/**
* @desc Initializes the Main object
*/
chromews.background.prototype.init = function() {
  /** Initializes properties */
  var currentWorkspace = 0;
  chrome.windows.getAll((windows_) => {
    goog.array.forEach((windows_), (window_,i,a) => {
      this.workspaces[currentWorkspace].push({
        id: window_.id,
        state: window_.state
      });
    });
  DEBUG2 && console.log('DATA: background.init: this.workspaces',
      this.workspaces);
  });

  /** Initializes Listeners */
  chrome.commands.onCommand.addListener( (command) => {
      this.handleCommand(command);
    });
}


/** DONE
* @desc Gets the display's work area where the window is.
* @param {!number} windowId
* @return {Promise}
*/
chromews.background.prototype.getDisplayWorkArea = function (windowId) {
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
chromews.background.prototype.tileWindow = function(movement) {
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
chromews.background.prototype.handleCommand = function(command) {
  DEBUG && console.log('INFO: background.handleCommand(',command,')');
  if (goog.string.startsWith(command, 'tile-')) {
    this.tileWindow(command);
    return;
  }
  if (command == 'debug') {
    console.log('DEBUG!!!');
  }
}


/**
 * Create and start extension
*/
/** @type {chromews.background} backgroundMain */
var backgroundMain = new chromews.background();
backgroundMain.init();
