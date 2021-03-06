/**
 * @fileoverview Background file for ChromeWM extension
 * @author EduCampi
 */
goog.provide('chromewm.background');

goog.require('edu.indxDB');
goog.require('goog.array');
goog.require('goog.events');
goog.require('goog.object');
goog.require('goog.storage.mechanism.HTML5LocalStorage');
goog.require('goog.string');

/**
 * These global variables are used for debugging.
 * They are removed by the compiler and not available at runtime.
 */
var DEBUG_CALLS = false; /** Logs Method calls. */
var DEBUG_WS = false;   /** Logs workspace changes. */


////////////////////////////////////////////
//            Initialization              //
////////////////////////////////////////////

var background = {};
goog.events.listenOnce(window, goog.events.EventType.LOAD, () => {
  background = new chromewm.background();
  background.Init();
});


/**
 * @desc Constructor for background object
 * @constructor @export
 */
chromewm.background = function() {
  /** @private {!number} currentWorkspace_ - Currently active workspace */
  this.currentWorkspace_ = 0;
  /** @private {edu.indxDB} db_ - Connection to the IndexedDB */
  this.db_ = new edu.indxDB();
  /** @private {!number} maxWorkspaces_ - As defined by the options page */
  this.maxWorkspaces_ = 4;
  /** @private {Object} storage_ - Local Storage for the extension options */
  this.storage_ = new goog.storage.mechanism.HTML5LocalStorage();
  /** @private {!boolean} switchingWS_ - Flag to ignore some listeners */
  this.switchingWS_ = false;
  /** @private {!Array<Object>} windows_ - Array of active Windows */
  this.windows_ = [];
}


/**
* @desc Initializes the background extension.
* Initialize properties, gets saved windows from DB, and starts listeners.
*/
chromewm.background.prototype.Init = function() {
  DEBUG_CALLS && console.log('CALL: Init()');

  var lastActiveWorkspace = this.storage_.get('lastActiveWorkspace');
  var isNewInstallation = goog.isNull(lastActiveWorkspace);

  this.maxWorkspaces_ = goog.string.parseInt(
      this.storage_.get('workspaceQty_') || 4);

  this.db_.getDB('chromewm', 1, [{'name': 'windows', 'keyPath': 'id'}])
  .then( () => {
    this.areWindowsLoaded_()
    .then((allWindows) => {
      var dbWindows = allWindows['dbWindows'];
      /** @type {!Array<Object<?>>} openWindows */
      var openWindows = allWindows['openWindows'];
      this.mergeWindowsToDb_(openWindows, dbWindows);

      if (isNewInstallation) {
         this.currentWorkspace_ = 1;
      } else {
        var isAnUpgrade = goog.array.every(openWindows, (openWindow, i, a) => {
            return goog.array.some(dbWindows, (dbWindow, i, a) => {
                return openWindow['id'] == dbWindow['id'];
            });
        });
        if (isAnUpgrade) {
          this.currentWorkspace_ = lastActiveWorkspace;
          chrome.browserAction.setIcon({
              'path': "icon-38-" + lastActiveWorkspace + ".png"});
        } else {
          this.showWorkspace_(lastActiveWorkspace);
        }
      }
      this.setListeners_();
    }).catch((error) => {
      console.error('ERROR: Unable to get Windows from Database',  error);
    });
  }).catch((error) => {
    console.error('ERROR: Unable to connect to the Database', error);
  });
}


/**
 * @desc Waits Chrome to load all windows after a restart
 * and returns the saved windows in the DB.
 * @private
 * @returns {!Promise}
 */
chromewm.background.prototype.areWindowsLoaded_ = function() {
  DEBUG_CALLS && console.log('CALL: areWindowsLoaded_()');

  return new Promise((resolve, reject) => {
    var timer = setInterval( () => {
      chrome.windows.getAll({'populate': true}, (openWindows) => {
        if ((openWindows.length > 1) || (openWindows[0]['tabs'].length > 1)) {
          clearInterval(timer);
          this.db_.getAllByStore('windows')
            .then((dbWindows) => {
                resolve({'dbWindows': dbWindows, 'openWindows': openWindows});
             })
            .catch(reject);
        }
      });
    }, 1000);

    setTimeout(reject, 10 * 60 * 1000);
  });
}


/**
 * @desc Merges open windows to the database and buils this.windows_ array
 * @param {!Array<Object<?>>} openWindows - Currently open windows
 * @param {!Array<Object<?>>} dbWindows - Windows currently in the database
 * @private
 */
chromewm.background.prototype.mergeWindowsToDb_ =
    function(openWindows, dbWindows) {
  goog.array.forEach(openWindows, (openWindow, i, a) => {
    var tabs = goog.string.hashCode(
        openWindow['tabs'].length.toString() +
        goog.array.last(openWindow['tabs'])['url']);

    var srcWindow = goog.array.find(dbWindows, (dbWindow, i, a) => {
        return dbWindow['tabs'] == tabs;
    });
    if (!srcWindow) srcWindow = openWindow;

    var windowToSave = {
      'focused': srcWindow['focused'],
      'height': srcWindow['height'],
      'id': openWindow['id'],
      'left': srcWindow['left'],
      'state': openWindow['state'],
      'tabs': tabs,
      'top': srcWindow['top'],
      'width': srcWindow['width'],
      'ws': 1
    }
    if (typeof srcWindow['ws'] !== 'undefined') {
      windowToSave['ws'] = srcWindow['ws'];
      windowToSave['state'] = srcWindow['state'];
    }

    this.windows_.push(windowToSave);
  });
  this.db_.delAllByStore('windows');
  this.db_.addToStore(this.windows_);
}


/**
 * @desc Starts all event listeners
 * @private
 */
chromewm.background.prototype.setListeners_ = function() {
  DEBUG_CALLS && console.log('CALL: setListeners_()');

  goog.events.listen(
    window,
    goog.events.EventType.STORAGE,
    (e) => {
      this.maxWorkspaces_ = goog.string.toNumber(e.event_.newValue);
    }
  );

  chrome.tabs.onUpdated.addListener( (tabId, changeInfo, tab) => {
    if (changeInfo['status'] == "complete") {
      this.onTabChange_(tab['windowId']);
    }
  });

  chrome.tabs.onMoved.addListener( (tabId, moveInfo) => {
    this.onTabChange_(moveInfo['windowId']);
  });

  chrome.tabs.onAttached.addListener( (tabId, attachInfo) => {
    this.onTabChange_(attachInfo['newWindowId']);
  });

  chrome.tabs.onDetached.addListener( (tabId, detachInfo) => {
    this.onTabChange_(detachInfo['oldWindowId']);
  });

  chrome.tabs.onRemoved.addListener( (tabId, removeInfo) => {
      this.onTabChange_(removeInfo['windowId']);
  });

  chrome.windows.onFocusChanged.addListener( (windowId) => {
    if ((windowId != chrome.windows.WINDOW_ID_NONE) && (!this.switchingWS_)) {
      this.onWindowFocus_(windowId);
    }
  });

  chrome.commands.onCommand.addListener( (command) => {
      this.onCommand_(command);
  });

}


/////////////////////////////////////////////
//              Event Listener             //
/////////////////////////////////////////////

/**
* @desc Acts on keyboard shortcuts calling the proper function.
* @private
* @param {!string} command - The command received as defined in Manifest.json
*/
chromewm.background.prototype.onCommand_ = function(command) {
  DEBUG_CALLS && console.log('CALL: onCommand_(',command,')');

  var splitCommand = goog.string.splitLimit(command, '-', 1);

  switch (splitCommand[0]) {
    case 'tile':
      this.tileWindow_(splitCommand[1]);
      break;
    case 'ws':
      switch (splitCommand[1]) {
        case 'next':
          this.showWorkspace_(this.currentWorkspace_ + 1);
          break;
        case 'prev':
          this.showWorkspace_(this.currentWorkspace_ - 1);
          break;
        case '1':
          this.showWorkspace_(1);
          break;
        case '2':
          this.showWorkspace_(2);
          break;
        case '3':
          this.showWorkspace_(3);
          break;
        case '4':
          this.showWorkspace_(4);
      }
      break;
  }
}


/**
 * @desc Updates the DB when a window gets focus.
 * @param {!number} windowId - ID of the window receiving focus.
 * @private
 */
chromewm.background.prototype.onWindowFocus_ = function(windowId) {
  DEBUG_CALLS && console.log('CALL: onWindowFocus_(',windowId,')');

  var windowsToSave_ = [];

  goog.array.forEach(this.windows_, (thisWindow_, i, a) => {
    var shouldHaveFocus = (thisWindow_['id'] == windowId);
    var inCurrentWS = (thisWindow_['ws'] == this.currentWorkspace_);

    if ( inCurrentWS && (thisWindow_['focused'] != shouldHaveFocus) ) {
      thisWindow_['focused'] = shouldHaveFocus;
      windowsToSave_.push(thisWindow_);

    } else if (!inCurrentWS && shouldHaveFocus) {
      var prevWS = thisWindow_['ws'];
      thisWindow_['ws'] = this.currentWorkspace_;
      thisWindow_['focused'] = true;
      windowsToSave_.push(thisWindow_);

      goog.array.some(this.windows_, (thisWin_, i, a) => {
        if (thisWin_['ws'] == prevWS) {
          thisWin_['focused'] = true;
          windowsToSave_.push(thisWin_);
          return true;
        } else {
          return false;
        }
      });
    }
  });

  if (windowsToSave_.length > 0)
    this.db_.addToStore(windowsToSave_);
}


/**
 * @desc Updates the DB if a window tabs, or workspace changed.
 * @private
 * @param {!number} windowId - ID of the window where a Tab had an event.
 */
chromewm.background.prototype.onTabChange_ = function(windowId) {
  DEBUG_CALLS && console.log('CALL: onTabChange_(', windowId, ')');

  chrome.windows.get(windowId, {'populate': true}, (window_) => {
    if(chrome.runtime.lastError || window_['tabs'].length == 0) {
      goog.array.removeIf(this.windows_, (thisWindow_,i,a) => {
        return thisWindow_['id'] == windowId;
      });
      this.db_.delByKey([windowId]);
      if (!this.switchingWS_ &&
          !goog.array.some(this.windows_, (thisWindow_, i ,a) => {
              return thisWindow_['ws'] == this.currentWorkspace_;
          })) {
        if (this.currentWorkspace_ > 1) {
          this.showWorkspace_(this.currentWorkspace_ - 1);
        } else if (this.windows_.length != 0) {
          this.showWorkspace_(this.windows_[0]['ws']);
        }
      }
    } else {
      var tabs_ = goog.string.hashCode(
          window_['tabs'].length.toString() +
          goog.array.last(window_['tabs'])['url']);

      if (!goog.array.some(this.windows_, (thisWindow_, i, a) => {
        if (thisWindow_['id'] == windowId) {
          if (thisWindow_['tabs'] != tabs_) {
            thisWindow_['tabs'] = tabs_;
            this.db_.addToStore([thisWindow_]);
          }
          return true;
        } else {
          return false;
        }
        })) {
        var windowToSave_ = {
            'focused': window_['focused'],
            'height': window_['height'],
            'id': window_['id'],
            'left': window_['left'],
            'state': window_['state'],
            'tabs': tabs_,
            'top': window_['top'],
            'width': window_['width'],
            'ws': this.currentWorkspace_
        };
        this.windows_.push(windowToSave_);
        this.db_.addToStore([windowToSave_]);
      }
    }
  });
}


////////////////////////////////////////////
//           Window Tiling Logic          //
////////////////////////////////////////////

/**
 * @desc Tiles a window to the direction specified.
 * @private
 * @param {!string} movement - Where to move the window (left, right, up, down).
 */
chromewm.background.prototype.tileWindow_ = async function(movement) {
  DEBUG_CALLS && console.log('CALL: tileWindow_(',movement,')');

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
      var newSize = {
        'left': window_['left'],
        'height': window_['height'],
        'top': window_['top'],
        'width': window_['width']
      };
      switch(movement) {
        case 'left':
          newSize['left'] = workArea['left'];
          if (window_['left'] == workAreaCenter.h) {
            newSize['width'] = workArea['width'];
          } else {
            newSize['width'] = tileSize.width;
          }
          break;
        case 'right':
          if (window_['left'] == workArea['left'] &&
              window_['width'] == tileSize.width) {
            newSize['width'] = workArea['width'];
          } else {
            newSize['left'] = workAreaCenter.h;
            newSize['width'] = tileSize.width;
          }
          break;
        case 'up':
          if (window_['state'] == 'maximized') return;
          if (window_['top'] == workArea['top'] &&
              window_['height'] == tileSize.height) {
            newSize['state'] = 'maximized';
          } else {
            newSize['top'] = workArea['top'];
            if (window_['height'] != tileSize.height) {
              newSize['height'] = tileSize.height;
            } else {
              newSize['height'] = workArea['height'];
            }
          }
          break;
        case 'down':
          if (window_['top'] == workArea['top'] &&
              window_['height'] == tileSize.height) {
            newSize['height'] = workArea['height'];
          } else {
            newSize['height'] = tileSize.height;
            newSize['top'] = workAreaCenter.v;
          }
          break;
        default:
          return;
      };
      if (window_['state'] == 'maximized') {
        chrome.windows.update(window_['id'], {'state': 'normal'}, () => {
          if (movement == 'left') {
            chrome.windows.update(window_['id'], {'left': workArea['left']+1});
          }
          chrome.windows.update(window_['id'], newSize);
        });
      } else if (newSize['state'] == 'maximized') {
        chrome.windows.update(window_['id'], {'state': 'maximized'});
      } else {
        chrome.windows.update(window_['id'], newSize);
      }
      this.saveWindowSize_(window_['id']);
    })
    .catch(err => {
      console.error('ERROR: Unable to get Display work area', err);
    });
  });
}


/**
 * @desc Gets the display's work area where the specified window is open.
 * @private
 * @param {!number} windowId - ID of the window that we want its display's info.
 * @return {!Promise} - On success, it returns the workArea of the display.
 */
chromewm.background.prototype.getDisplayWorkArea_ = function(windowId) {
  DEBUG_CALLS && console.log('CALL: getDisplayWorkArea_(',windowId,')');

  var displayInFocus = {};
  return new Promise((resolve, reject) => {
    chrome.system.display.getInfo( (displays) => {
      chrome.windows.get(windowId, (window_) => {
        displayInFocus = goog.array.find(displays, (display, i, a) => {
          var workArea = display['workArea'];
          return ((window_['left'] >= workArea['left']) &&
              (window_['left'] < workArea['left'] + workArea['width']) &&
              (window_['top'] >= workArea['top']) &&
              (window_['top'] < workArea['top'] + workArea['height']));
        });
        if (goog.object.containsKey(displayInFocus, 'workArea')) {
          resolve(displayInFocus['workArea'])
        } else {
          reject();
        }
      });
    });
  });
}


/**
 * @desc Updates the DB when a window changes size or position.
 * @param {!number} windowId - ID of the window changing.
 * @private
 */
chromewm.background.prototype.saveWindowSize_ = function(windowId) {
  DEBUG_CALLS && console.log('CALL: saveWindowSize_(',windowId,')');

  chrome.windows.get(windowId, (window_) => {
    var thisWindow_ = goog.array.find(this.windows_, (thisWindow_, i, a) => {
        return thisWindow_['id'] == windowId;
    });

    var windowSize = {
        'height': window_['height'],
        'left': window_['left'],
        'state': window_['state'],
        'top': window_['top'],
        'width': window_['width']
    };

    if (goog.object.some(windowSize, (val, key, obj) => {
          return thisWindow_[key] != val;
        })) {
      goog.object.extend(thisWindow_, windowSize);
      this.db_.addToStore([thisWindow_]);
    }
  });
}


////////////////////////////////////////////
//            Workspaces Logic            //
////////////////////////////////////////////

/**
 * @desc Shows the specified workspace.
 *       Opens a new browser window if the workspace is empty.
 * @private
 * @param {!number} newWorkspace - Workspace number to show.
 */
chromewm.background.prototype.showWorkspace_ = function(newWorkspace) {
  DEBUG_CALLS && console.log('CALL: showWorkspace_(',newWorkspace,')');

  if ((newWorkspace == this.currentWorkspace_) ||
      (newWorkspace < 1) || (newWorkspace > this.maxWorkspaces_)) {
    return;
  }

  var focusedWindowId, minimizedWindowId;
  var newWindowHash = goog.string.hashCode('1' + 'chrome://newtab/');

  this.switchingWS_ = true;

  goog.array.forEach(this.windows_, (thisWindow_,i,a) => {
    if (thisWindow_['ws'] == this.currentWorkspace_) {
      if (thisWindow_['tabs'] == newWindowHash) {
        DEBUG_WS && console.log('WS: REMOVING:', thisWindow_);
        chrome.windows.remove(thisWindow_['id']);
      } else {
        DEBUG_WS && console.log('WS: HIDING:', thisWindow_);
        this.saveWindowSize_(thisWindow_['id']);
        chrome.windows.update(thisWindow_['id'], {'state': 'minimized'});
      }
    }
  });

  goog.array.forEach(this.windows_, (thisWindow_,i,a) => {
    if (thisWindow_['ws'] == newWorkspace) {
      if (thisWindow_['focused']) {
        focusedWindowId = thisWindow_['id'];
      }
      if (thisWindow_['state'] == 'minimized') {
        minimizedWindowId = thisWindow_['id'];
      } else {
        DEBUG_WS && console.log('WS: SHOWING:', thisWindow_);
        chrome.windows.update(thisWindow_['id'], {'focused': true});
        chrome.windows.update(thisWindow_['id'], {
            'height': thisWindow_['height'],
            'left': thisWindow_['left'],
            'top': thisWindow_['top'],
            'width': thisWindow_['width']
        });
      }
    }
  });

  if (typeof focusedWindowId === 'undefined') {
    if (typeof minimizedWindowId === 'undefined') {
      chrome.windows.create({'url': "chrome://newtab/", 'state': 'maximized'});
    } else {
      chrome.windows.update(minimizedWindowId, {'focused': true});
    }
  } else {
    chrome.windows.update(focusedWindowId, {'focused': true});
  }
  this.currentWorkspace_ = newWorkspace;
  this.storage_.set('lastActiveWorkspace', newWorkspace);
  this.showWsTransition_(newWorkspace);

  var timer = setInterval( async () => {
    if (await this.areWindowsUpdated_()) {
      clearInterval(timer);
      this.switchingWS_ = false;
    };
  }, 500);
}


/**
 * @desc Displays Notification and changes extension icon on workspace change.
 * @private
 * @param {!number} newWorkspace - Workspace number to show.
 */
chromewm.background.prototype.showWsTransition_ = async function(newWorkspace) {
  DEBUG_CALLS && console.log('CALL: showWsTransition_(',newWorkspace,')');

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


/**
 * @desc Checks if all windows finished updating after the workspace changed.
 * @returns {!Promise} - It always resolves to either true or false.
 */
chromewm.background.prototype.areWindowsUpdated_ = function() {
  DEBUG_CALLS && console.log('CALL: areWindowsUpdated_()');

  return new Promise((resolve) => {
    chrome.windows.getAll((windows_) => {
      resolve (goog.array.every(windows_, (window_, i, a) => {
        return goog.array.some(this.windows_, (thisWindow_, i_, a_) => {
          if (thisWindow_['id'] == window_['id']) {
            if (thisWindow_['ws'] == this.currentWorkspace_) {
              return window_['state'] == thisWindow_['state'];
            } else {
              return window_['state'] == 'minimized';
            }
          }
          return false;
        });
      }));
    });
  });
}
