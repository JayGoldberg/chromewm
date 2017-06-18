/**
 * @fileoverview Background file
 * @author EduCampi
 */

goog.provide('chromews.background');

goog.require('chromews.window');
goog.require('goog.array');



/**
 * @desc Defines main object
 * @constructor @export
 */
chromews.background = function() {
}


/**
* @desc Initializes the Main object
*/
chromews.background.prototype.init = function() {
  /** Initializes properties */
  this.window = new chromews.window();

  /** Initializes Listeners */
  chrome.commands.onCommand.addListener( (command) => {
      this.handleCommand(command)
    });
}


/**
* @desc Gets the display where the window is.
* @param {requestCallback} callback
*/
chromews.background.prototype.getDisplay = function (callback) {
  chrome.system.display.getInfo( (displays) => {
    chrome.windows.getLastFocused( (window_) => {
      callback(goog.array.find(displays, (display, indx, list) => {
        return (window_.left < (display.workArea.left + display.workArea.width))
          && (window_.top < (display.workArea.top + display.workArea.height))
        })
      );
    });
  });
}


/**
* @desc Handles command recieved
* @param {string} command
*/
chromews.background.prototype.handleCommand = function(command) {
  var newCoordinates_ = {};
  switch(command) {
    case 'tile-left':
      newCoordinates_.left = 0;
      newCoordinates_.width = Math.round(screen.availWidth / 2);
      this.handleWindow(newCoordinates_);
      break;
    case 'tile-right':
      break;
    case 'tile-up':
      newCoordinates_.top = 0;
      newCoordinates_.height = Math.round(screen.availHeight / 2);
      this.handleWindow(newCoordinates_);
      break;
    case 'tile-down':
      this.getWindowState((state) => {console.log(state);});
  //    this.getDisplay((display) => {console.log(display);});
      break;
    default:
      console.log('Unrecognized command: ', command);
  };
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
  console.log('Boundaries: ', tilingBoundaries);

  chrome.windows.getLastFocused( (window_) => {
    console.log(window_);
    if (window_.width == tilingBoundaries.horizontal) {
      if (window_.left == tilingBoundaries.horizontal) {
        tilingState.horizontal = 'right';
      } else {
        tilingState.horizontal = 'left';
      };
    };
    if (window_.height == tilingBoundaries.vertical) {
      if (window_.top == tilingBoundaries.vertical) {
        tilingState.vertical = 'bottom';
      } else {
        tilingState.vertical = 'top';
      };
    };
    callback(tilingState);
  });
}

/**
* @desc Handle window
* @param {Object} newCoordinates_
*/
chromews.background.prototype.handleWindow = function(newCoordinates_) {
  chrome.windows.getLastFocused( (window_) => {
    if (window_.state != 'normal') {
      chrome.windows.update(window_.id, {state: 'normal'});
    };
    chrome.windows.update(window_.id, newCoordinates_);
    }
  );
}


/**
 * Create and start extension
*/
/** @type {chromews.background} backgroundMain */
var backgroundMain = new chromews.background();
backgroundMain.init();
