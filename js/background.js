/**
 * @fileoverview Background file
 * @author EduCampi
 */

goog.provide('chromews.background');

// goog.require('chromews.window');
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
  // this.windows = [{}];
  this.workspaces = [[]];
  // this.displays= [{}];
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
  DEBUG2 && console.log('DATA: this.workspaces', this.workspaces);
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


/** DONE
 * @desc Gets the id of the window in focus
 * @return {Promise}
 */
chromews.background.prototype.getFocusedWindowId = function() {
  return new Promise((resolve, reject) => {
    chrome.windows.getLastFocused((window_) => {
      if (goog.object.containsKey(window_, 'id')) {
        resolve(window_.id);
      } else {
        reject(Error('Unable to get focused window id'));
      }
    });
  });
}


/**
 * @desc Tiles window
 * @param {string} movement
 */
chromews.background.prototype.tileWindow = function(movement) {
  DEBUG && console.log('INFO: background.tileWindow(',movement,')');
  var newCoordinates = {};
  this.getFocusedWindowId().then( (id) => {
    this.getDisplayWorkArea(id).then( (workArea) => {
      switch(movement) {
        case 'tile-left':
          newCoordinates.left = workArea.left;
          newCoordinates.width = Math.round(workArea.width/2);
          break;
        case 'tile-right':
          newCoordinates.left = workArea.left + Math.round(workArea.width/2);
          newCoordinates.width = Math.round(workArea.width/2);
          break;
        case 'tile-up':
          newCoordinates.top = workArea.top;
          newCoordinates.height = Math.round(workArea.height/2);
          break;
        case 'tile-down':
          newCoordinates.top = workArea.top + Math.round(workArea.height/2);
          newCoordinates.height = Math.round(workArea.height/2);
          break;
        default:
          console.log('ERROR: Unrecognized command recieved in tileWindow: ',
              movement);
      };
      DEBUG2 && console.log('INFO: Tiling window to coordinates: ',
          newCoordinates);
      chrome.windows.update(id, newCoordinates);
      }
    );
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
* @desc Returns current tiling state of the window
//TODO(): Multiple screens
//TODO(): If not maximized, but flotting in the screen
*/
chromews.background.prototype.getWindowState = function(callback) {
  var tilingState = {
    horizontal: 'full',
    vertical: 'full'
  };
  /** @type {Object} tilingBoundaries */
  var tilingBoundaries = {
    horizontal: Math.round(screen.availWidth / 2),
    vertical: Math.round(screen.availHeight / 2)
  };

  // chrome.windows.getLastFocused( (window_) => {
  this.window.getPropertiesbyFocus()
    .then( (properties) => {
      console.log('window Properties: ', properties);
      if (properties.width == tilingBoundaries.horizontal) {
        if (properties.left == tilingBoundaries.horizontal) {
          tilingState.horizontal = 'right';
        } else {
          tilingState.horizontal = 'left';
        };
      };
      if (properties.height == tilingBoundaries.vertical) {
        if (properties.top == tilingBoundaries.vertical) {
          tilingState.vertical = 'bottom';
        } else {
          tilingState.vertical = 'top';
        };
      };
      callback(tilingState);
  });
}

// /**
// * @desc adds Window to this.windows
// * @param {Object} window_
// */
// chromews.background.prototype.addWindow = function(window_) {
//   DEBUG && console.log('INFO: background.addWindow()');
//   var newWindow = new chromews.window();
//   return new Promise((resolve, reject) => {
//     newWindow.setProperties(window_)
//       .then( this.windows.push(newWindow)
//   })
// }

/**
 * Create and start extension
*/
/** @type {chromews.background} backgroundMain */
var backgroundMain = new chromews.background();
backgroundMain.init();
