/**
 * @fileoverview Background file
 * @author EduCampi
 */

goog.provide('chromews.background');

goog.require('chromews.window');
// goog.require('goog.array');

const DEBUG = true; // Logs every Method execution.
const DEBUG2 = true; // Logs data verifications

/**
 * @desc Defines main object
 * @constructor @export
 */
chromews.background = function() {
  /** @type {chromews.window} window */
  this.window = new chromews.window();
}


/**
* @desc Initializes the Main object
*/
chromews.background.prototype.init = function() {
  /** Initializes properties */

  /** Initializes Listeners */
  chrome.commands.onCommand.addListener( (command) => {
      this.handleCommand(command);
    });
}


/**
* @desc Gets the display where the window is.
* @param {requestCallback} callback
*/
// chromews.background.prototype.getDisplay = function (callback) {
//   chrome.system.display.getInfo( (displays) => {
//     chrome.windows.getLastFocused( (window_) => {
//       callback(goog.array.find(displays, (display, indx, list) => {
//         return (window_.left < (display.workArea.left + display.workArea.width))
//           && (window_.top < (display.workArea.top + display.workArea.height))
//         })
//       );
//     });
//   });
// }


/**
* @desc Handles command recieved
* @param {string} command
*/
chromews.background.prototype.handleCommand = function(command) {
  DEBUG && console.log('INFO: background.handleCommand()');
  var newCoordinates_ = {};
  this.window.getPropertiesbyFocus()
    .then( (properties) => {
      switch(command) {
        case 'tile-left':
          newCoordinates_.left = 0;
          newCoordinates_.width = Math.round(screen.availWidth / 2);
          this.window.setProperties(newCoordinates_)
            .then( () => {
              this.window.Update();
          });
          break;
        case 'tile-right':
          break;
        case 'tile-up':
          newCoordinates_.top = 0;
          newCoordinates_.height = Math.round(screen.availHeight / 2);
          this.window.setProperties(newCoordinates_)
            .then( () => {
              this.window.Update();
          });
          break;
        case 'tile-down':
          this.getWindowState((state) => {console.log(state);});
          break;
        default:
          console.log('Unrecognized command: ', command);
      };
    });
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


/**
 * Create and start extension
*/
/** @type {chromews.background} backgroundMain */
var backgroundMain = new chromews.background();
backgroundMain.init();
