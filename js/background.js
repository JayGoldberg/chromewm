/**
 * @fileoverview Background file
 * @author EduCampi
 */

// TODO(): 1) Cleanup and improve code quality
// TODO(): 1a) Can assign objects per reference, see what can be improved.
// TODO(): 1b) Implement Promises properly, resolve and reject
// TODO(): 1c) What can be done async ?
// TODO(): 2) IndexedDB not working for crashes

goog.provide('chromewm.background');

goog.require('edu.indxDB');
goog.require('goog.array');
goog.require('goog.events');
goog.require('goog.object');
goog.require('goog.storage.mechanism.HTML5LocalStorage');
goog.require('goog.string');

var DEBUG_CALLS = false; // Logs Method calls.
var DEBUG_WS = false; // Debugs Workspaces


////////////////////////////////////////////
//          Initialization Logic          //
////////////////////////////////////////////

/**
 * @desc Defines main object
 * @constructor @export
 */
chromewm.background = function() {
  /** @private {!Array<Object>} windows_ */
  this.windows_ = [];
  /** @private {number} maxWorkspaces_ */
  this.maxWorkspaces_ = 4;
  /** @private {number} currentWorkspace_ */
  this.currentWorkspace_ = 0;
  /** @private {Object} storage_ */
  this.storage_ = new goog.storage.mechanism.HTML5LocalStorage();
  /** @private {edu.indxDB} db_ */
  this.db_ = new edu.indxDB();
}


/**
* @desc Initializes the Main object
*/
chromewm.background.prototype.Init = function() {

  this.maxWorkspaces_ = goog.string.parseInt(
      this.storage_.get('workspaceQty_')) || 4;

  this.db_.getDB('chromewm', 1, [{'name': 'windows', 'keyPath': 'id'}])
    .then( () => {
    this.waitForWindows_().then(savedWindows_ => {
      console.log('INFO: savedWindows_', savedWindows_);
      chrome.windows.getAll({'populate': true}, (windows_) => {
        goog.array.forEach(windows_, (window_,i,a) => {
          var windowToSave_ = {};
          var tabs_ = goog.string.hashCode(
              window_['tabs'].length.toString() +
              goog.array.last(window_['tabs'])['url']);

          if (!goog.array.some(savedWindows_, (sW_, sI, sA) => {
              if (sW_['tabs'] == tabs_) {
                windowToSave_ = {
                  'focused': sW_['focused'],
                  'id': window_['id'],
                  'state': sW_['state'],
                  'tabs': tabs_,
                  'ws': sW_['ws']
                };
                return true;
              } else {
                return false;
              }
              })) {
            windowToSave_ = {
              'focused': window_['focused'],
              'id': window_['id'],
              'state': window_['state'],
              'tabs': tabs_,
              'ws': 1
            };
          }
          this.windows_.push(windowToSave_);
        });
      this.showWorkspace_(1);
      this.db_.delAllByStore('windows');
      this.db_.addToStore(this.windows_);
      this.setListeners_();
      });
    }).catch((error) => {
      console.log('CRITICAL ERROR: Unable to check Storage for Windows', error);
    });
  }).catch((error) => {
    console.log('CRITICAL ERROR: Unable to connect to Database', error);
  });
}


/** DONE
 * @desc Start all listeners
 * @private
 */
chromewm.background.prototype.setListeners_ = function() {
  goog.events.listen(
    window,
    goog.events.EventType.STORAGE,
    (e) => {
      this.maxWorkspaces_ = goog.string.toNumber(e.event_.newValue);
    }
  );

  chrome.tabs.onUpdated.addListener( (tabId, changeInfo, tab) => {
    if (changeInfo['status'] == "complete") {
      this.updateWindow_(tab['windowId']);
    }
  });

  chrome.tabs.onMoved.addListener( (tabId, moveInfo) => {
    this.updateWindow_(moveInfo['windowId']);
  });

  chrome.tabs.onAttached.addListener( (tabId, attachInfo) => {
    this.updateWindow_(attachInfo['newWindowId']);
  });

  chrome.tabs.onDetached.addListener( (tabId, detachInfo) => {
    this.updateWindow_(detachInfo['oldWindowId']);
  });

  chrome.tabs.onRemoved.addListener( (tabId, removeInfo) => {
      this.updateWindow_(removeInfo['windowId']);
  });

  chrome.windows.onFocusChanged.addListener( (windowId) => {
    if (windowId != chrome.windows.WINDOW_ID_NONE) {
      goog.array.forEach(this.windows_, (thisWindow_, i, a) => {
        var shouldBeFocused = (thisWindow_['id'] == windowId);
        if (thisWindow_['ws'] == this.currentWorkspace_) {
          if (shouldBeFocused || thisWindow_['focused']) {
            thisWindow_['focused'] = shouldBeFocused;
            this.db_.addToStore([thisWindow_]);
          }
        } else if (shouldBeFocused) {
          thisWindow_['ws'] = this.currentWorkspace_;
          this.db_.addToStore([thisWindow_]);
        }
      });
    }
  });

  chrome.commands.onCommand.addListener( (command) => {
      this.commandHandler_(command);
  });

}

/**
 * @desc Waits Chrome to reload all windows after a crash
 * @private
 */
 // TODO(): Add condition, if it goes too long (or the user never chose to restore)
chromewm.background.prototype.waitForWindows_ = function() {
  return new Promise((resolve, reject) => {
    this.db_.getAllByStore('windows').then(savedWindows_ => {
      var savedLength = savedWindows_.length;
      var timer = setInterval( () => {
        chrome.windows.getAll((windows_) => {
          if (windows_.length >= savedLength) {
            clearInterval(timer);
            resolve(savedWindows_);
          }
        });
      }, 500);
    }).catch(reject);
  });
}


/**
 * @desc Updates the entry for windowId in this.windows_ and this.db_
 * @private
 * @param {!number} windowId
 */
chromewm.background.prototype.updateWindow_ = function(windowId) {
  DEBUG_CALLS && console.log('updateWindow_ ', windowId);

  chrome.windows.get(windowId, {'populate': true}, (window_) => {
    if(chrome.runtime.lastError || window_['tabs'].length == 0) {
      goog.array.removeIf(this.windows_, (thisWindow_,i,a) => {
        return thisWindow_['id'] == windowId;
      });
      this.db_.delByKey([windowId]);
      return;
    } else {
      var tabs_ = goog.string.hashCode(
          window_['tabs'].length.toString() +
          goog.array.last(window_['tabs'])['url']);

      if (!goog.array.some(this.windows_, (thisWindow_, indx, a) => {
        if (thisWindow_['id'] == windowId) {
          if (thisWindow_['tabs'] != tabs_ ||
              thisWindow_['focused'] != window_['focused']) {
            thisWindow_['tabs'] = tabs_;
            this.db_.addToStore([thisWindow_]);
          }
          return true;
        } else {
          return false;
        }
        })) {
        var windowToSave = {
            'focused': window_['focused'],
            'id': window_['id'],
            'state': window_['state'],
            'tabs': tabs_,
            'ws': this.currentWorkspace_
        };
        this.windows_.push(windowToSave);
        this.db_.addToStore([windowToSave]);
      }
    }
  });
}


////////////////////////////////////////////
//            Workspaces Logic            //
////////////////////////////////////////////

/**
 * @desc Provides visual feedback to user on workspace change
 * @private
 * @param {!number} newWorkspace
 */
chromewm.background.prototype.showWsTransition_ = function(newWorkspace) {
  chrome.notifications.create("workspaceChange", {
      'type': "basic",
      'title': "\rWorkspace " + newWorkspace,
      'message': "",
      'iconUrl': "icon-64-" + newWorkspace + ".png",
      'priority': 2
      },
      (notificationId_) => {
        setTimeout(() => {
          chrome.notifications.clear(notificationId_);}, 2000);
  });

  chrome.browserAction.setIcon({
    'path': "icon-38-" + newWorkspace + ".png"
  });
}


/** DONE
 * @desc Switches to new workspace
 * @private
 * @param {!string} command
 */
chromewm.background.prototype.changeWorkspace_ = function(command) {
  DEBUG_CALLS && console.log('changeWorkspace_(',command,')');

  if (command == "ws-next" && this.currentWorkspace_ < this.maxWorkspaces_) {
    this.showWorkspace_(this.currentWorkspace_ + 1);
  } else if (command == "ws-prev" && this.currentWorkspace_ > 1) {
    this.showWorkspace_(this.currentWorkspace_ - 1);
  }
}


/**
 * @desc Shows the specified workspace
 * @private
 * @param {!number} newWorkspace
 */
chromewm.background.prototype.showWorkspace_ = function(newWorkspace) {
  DEBUG_CALLS && console.log('CALL: showWorkspace_(',newWorkspace,');');

  if (!(newWorkspace >= 1 && newWorkspace <= this.maxWorkspaces_)) {
    return;
  }
  var windowIdInFocus;
  var newWindowHash = goog.string.hashCode('1' + 'chrome://newtab/');

  goog.array.forEach(this.windows_, (thisWindow_,i,a) => {
    if (thisWindow_['ws'] == this.currentWorkspace_) {
      if (thisWindow_['tabs'] == newWindowHash) {
        DEBUG_WS && console.log('REMOVING:', thisWindow_);
        chrome.windows.remove(thisWindow_['id']);
      } else {
        DEBUG_WS && console.log('HIDING:', thisWindow_);
        chrome.windows.update(thisWindow_['id'], {'state': 'minimized'});
      }
    } else if (thisWindow_['ws'] == newWorkspace) {
      DEBUG_WS && console.log('SHOWING:', thisWindow_);
      chrome.windows.update(thisWindow_['id'], {'focused': true});
      if (thisWindow_['focused']) {
        windowIdInFocus = thisWindow_['id'];
      }
    }
  });

  if (typeof windowIdInFocus === 'undefined') {
    chrome.windows.create({'url': "chrome://newtab/", 'state': 'maximized'});
  } else {
    chrome.windows.update(windowIdInFocus, {'focused': true});
  }
  this.currentWorkspace_ = newWorkspace;
  this.showWsTransition_(newWorkspace);
}


////////////////////////////////////////////
//          Tiling Windows Logic          //
////////////////////////////////////////////

/**
 * @desc Tiles window
 * @private
 * @param {!string} movement
 */
chromewm.background.prototype.tileWindow_ = function(movement) {
  DEBUG_CALLS && console.log('tileWindow_(',movement,')');

  var newSize = {};
  chrome.windows.getLastFocused((window_) => {
    this.getDisplayWorkArea_(window_['id']).then((workArea) => {
      var tileSize = {
        height: Math.round(workArea['height']/2),
        width: Math.round(workArea['width']/2)
      };
      var workAreaCenter = {
        h: workArea['left'] + tileSize.width,
        v: workArea['top'] + tileSize.height
      };
      switch(movement) {
        case 'tile-left':
          newSize['left'] = workArea['left'];
          if (window_['left'] == workAreaCenter.h &&
              window_['width'] == tileSize.width) {
            newSize['width'] = workArea['width'];
          } else {
            newSize['width'] = tileSize.width;
          }
          break;
        case 'tile-right':
          if (window_['left'] == workArea['left'] &&
              window_['width'] == tileSize.width) {
            newSize['width'] = workArea['width'];
          } else {
            newSize['left'] = workAreaCenter.h;
            newSize['width'] = tileSize.width;
          }
          break;
        case 'tile-up':
          newSize['top'] = workArea['top'];
          if (window_['height'] == tileSize.height) {
            if (window_['top'] == workArea['top']) {
              newSize = {'state': 'maximized'};
            } else if (window_['top'] == workAreaCenter.v) {
            newSize['height'] = workArea['height'];
            }
          } else {
            newSize['height'] = tileSize.height;
          }
          break;
        case 'tile-down':
          if (window_['top'] == workArea['top'] &&
              window_['height'] == tileSize.height) {
            newSize['height'] = workArea['height'];
          } else {
            newSize['height'] = tileSize.height;
            newSize['top'] = workAreaCenter.v;
          }
          break;
        default:
          console.log('ERROR: Unrecognized command recieved in tileWindow_: ',
              movement);
          return;
      };

      if (window_['state'] == 'maximized') {
        chrome.windows.update(window_['id'], {'state': 'normal'});
      }
      chrome.windows.update(window_['id'], newSize);
    });
  });
}


/**
 * @desc Gets the display's work area where the window is.
 * @private
 * @param {!number} windowId
 * @return {Promise}
 */
chromewm.background.prototype.getDisplayWorkArea_ = function(windowId) {
  var displayInFocus = {};
  return new Promise((resolve, reject) => {
    chrome.system.display.getInfo( (displays) => {
      chrome.windows.get(windowId, (window_) => {
        displayInFocus = goog.array.find(displays, (display, i, a) => {
          return (window_['left'] <
              (display['workArea']['left'] + display['workArea']['width'])) &&
              (window_['top'] <
              (display['workArea']['top'] + display['workArea']['height']))
        });
        if (goog.object.containsKey(displayInFocus, 'workArea')) {
          resolve(displayInFocus['workArea'])
        } else {
          reject(Error("Failed to getDisplayWorkArea_"));
        }
      });
    });
  });
}


/////////////////////////////////////////////
//       Core functions                    //
/////////////////////////////////////////////
/** DONE
* @desc Handles keyboard commands
* @private
* @param {!string} command
*/
chromewm.background.prototype.commandHandler_ = function(command) {
  DEBUG_CALLS && console.log('commandHandler_(',command,')');

  if (goog.string.startsWith(command, 'tile-')) {
    this.tileWindow_(command);
    return;
  }
  if (goog.string.startsWith(command, 'ws-')) {
    this.changeWorkspace_(command);
    return;
  }
}


/////////////////////////////////////////////
//           Initialize Extension          //
/////////////////////////////////////////////
/** @type {chromewm.background} backgroundMain */
var backgroundMain = new chromewm.background();
backgroundMain.Init();
