/**
 * @fileoverview Provides Window Object
 * @author EduCampi
 */

 goog.provide('chromews.window');

 // goog.require('goog.array');
 goog.require('goog.object');

/**
 * @desc Defines chromews.Window Object
 * @constructor @export
 */
 chromews.window = function() {
   /** @type {Object<string, number|string>} properties */
   this.properties = {
     height: 0,
     id: 0,
     left: 0,
     state: 'normal',
     top: 0,
     width: 0
   }
 }


chromews.window.prototype.init = function(windowId) {
  DEBUG && console.log('INFO: window.init()');

}

/**
 * @desc Gets properties by providing the Id
 * @param {number} windowId
 */
chromews.window.prototype.getPropertiesbyId = function(windowId) {
  DEBUG && console.log('INFO: window.getPropertiesbyId()');
  return new Promise((resolve, reject) => {
    chrome.windows.get(windowId, (window_) => {
//TODO(): Why saving?
      this.setProperties(window_)
        .then(
            (properties) => {resolve(properties);},
            (err) => {reject(err);}
        );
    });
  });
}


/**
 * @desc Gets properties from the window in focus
 */
chromews.window.prototype.getPropertiesbyFocus = function() {
  DEBUG && console.log('INFO: window.getPropertiesbyFocus()');
  return new Promise((resolve, reject) => {
    chrome.windows.getLastFocused( (window_) => {
//TODO(): Why saving?
      this.setProperties(window_)
        .then(
            (properties) => {resolve(properties);},
            (err) => {reject(err);}
        );
      });
    });
}


/**
 * @desc Sets properties
 * @param {Object} newProperties
 */
chromews.window.prototype.setProperties = function(newProperties) {
  DEBUG && console.log('INFO: window.setProperties()');
  DEBUG2 && console.log('INFO: recieved newProperties:', newProperties);
  return new Promise((resolve, reject) => {
    goog.object.forEach(newProperties, (value, key, obj) => {
        if (goog.object.containsKey(this.properties, key)) {
          this.properties[key] = value;
        };
    });

    if (goog.object.every(newProperties, (value, key, obj) => {
        if (goog.object.containsKey(this.properties, key)) {
          DEBUG2 && console.log('INFO: Checking: this.properties[',key,'] is ',
              this.properties[key],', want ',value);
          return this.properties[key] == value;
        };
        return true;
        })) {
      resolve(this.properties);
    } else {
      reject(Error("Failed to setProperties"));
  }});
}

/**
 * @desc ReDraws the Window using the current properties
 */
chromews.window.prototype.Update = function() {
  DEBUG && console.log('INFO: window.Update()');
  DEBUG2 && console.log('INFO: this.properties:', this.properties);
  if (this.properties.state != 'normal') {
    this.properties.state = 'normal';
    chrome.windows.update(this.properties.id, {state:'normal'});
  };
  chrome.windows.update(this.properties.id, {
      height: this.properties.height,
      left: this.properties.left,
      top: this.properties.top,
      width: this.properties.width
  });
}


/**
* @desc Gets the display where the window is.
* @param {function()} callback
*/
// chromews.window.prototype.getDisplay = function (callback) {
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
