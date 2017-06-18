/**
 * @fileoverview Provides Window Object
 * @author EduCampi
 */

 goog.provide('chromews.window');

 goog.require('goog.array');

/**
 * @desc Defines chromews.Window Object
 * @constructor @export
 */
 chromews.window = function() {
   /** @type {Object} properties */
   this.properties = {
     windowId: 0,
     left = 0,
     top = 0,
     width = 0,
     height = 0,
     state: 'normal'
   }
 }


chromews.window.prototype.init = function(windowId) {

}

/**
 * @desc Gets properties by providing the Id
 * @param {number} windowId
 * @param {function=} callback
 */
chromews.window.prototype.getPropertiesbyId = function(windowId, callback) {
  chrome.windows.get(windowId, (window_) => {
    this.setProperties(window_);
    typeof callback === "function" && callback(this.properties);
  });
}

/**
 * @desc Gets properties by focus
 * @param {function} callback
 */
chromews.window.prototype.getPropertiesbyId = function(callback) {
  chrome.windows.getLastFocused( (window_) => {
    this.setProperties(window_);
    typeof callback === "function" && callback(this.properties);
  });
}

/**
 * @desc Sets properties
 * @param {Object} newProperties
 */
chromews.window.prototype.setProperties = function(newProperties) {
  this.properties = this.properties || newProperties;
}

/**
 * @desc ReDraws the Window using the current properties
 */
chromews.window.prototype.Update = function() {
  chrome.windows.update(this.properties.windowId, this.properties);
}


/**
* @desc Gets the display where the window is.
* @param {function} callback
*/
chromews.window.prototype.getDisplay = function (callback) {
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
