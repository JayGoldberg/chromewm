/**
 * @fileoverview Background file
 * @author EduCampi
 */

goog.provide('chromews.background');

goog.require('goog.string');

/**
 * @desc Defines main object
 * @constructor @export
 */
chromews.background = function() {
  /** @type {string} welcome */
  this.welcome = goog.string.capitalize('Hello!');

  // this.activeWindow = {};

}


/**
* @desc Initializes the Main object
*/
chromews.background.prototype.init = function() {

  /** Setting up Listeners */
  // chrome.browserAction.onClicked.addListener(this.handleWindow());
  chrome.commands.onCommand.addListener( (command) => {
      this.handleCommand(command)
    });
}


/**
* @desc Handles command recieved
* @param {string} command
*/
chromews.background.prototype.handleCommand = function(command) {
  console.log('Command: ', command);
}


/**
* @desc Handle window
* @param {Object} tab
*/
// chromews.background.prototype.handleWindow = function(tab) {
//   chrome.windows.getLastFocused( (window_) => {
//     console.log(window_);
//     chrome.windows.update(window_.id, {
//         state: 'normal',
//         top: window_.top,
//         left: window_.left,
//         width: Math.round(window_.width/2),
//         height: Math.round(window_.height/2),
//         }
//     );
//   });
// }


/**
 * Create and start extension
*/
/** @type {chromews.background} backgroundMain */
var backgroundMain = new chromews.background();
backgroundMain.init();
