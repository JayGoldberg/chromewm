/**
 * @fileoverview Background file for ChromeWM extension
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

/** The following global variables are used for debugging.
 *  They are removed by the compiler as they don't change values once set.
 *  They're not accessible at runtime.
 */
var DEBUG_CALLS = true; /** Logs Method calls. */
var DEBUG_WS = true; /** Logs workspace changes. */

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
  /** @private {!boolean} switchingWS_ */
  this.switchingWS_ = false;
}


/**
* @desc Initializes the Main object
*/
chromewm.background.prototype.Init = function() {
  DEBUG_CALLS && console.log('CALL: Init()');

  this.maxWorkspaces_ = goog.string.parseInt(
      this.storage_.get('workspaceQty_')) || 4;

  this.db_.getDB('chromewm', 1, [{'name': 'windows', 'keyPath': 'id'}])
  .then( () => {
    this.waitForWindows_()
    .then(savedWindows_ => {
      true && console.log('INFO: INIT savedWindows_:', savedWindows_);
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


/**
 * @desc Start all listeners
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
    if ((windowId != chrome.windows.WINDOW_ID_NONE) && (!this.switchingWS_)) {
      this.handleWindowFocusChange_(windowId);
    }
  });

  chrome.commands.onCommand.addListener( (command) => {
      this.commandHandler_(command);
  });

}


/**
 * @desc Handles the event when a window recieves focus
 * @param {!number} windowId
 * @private
 */
chromewm.background.prototype.handleWindowFocusChange_ = function(windowId) {
  DEBUG_CALLS && console.log('CALL: handleWindowFocusChange_(',windowId,')');

  goog.array.forEach(this.windows_, (thisWindow_, i, a) => {
    var shouldBeFocused = (thisWindow_['id'] == windowId);

    if (thisWindow_['ws'] == this.currentWorkspace_) { // If happens in the active workspace

      if ((shouldBeFocused && !thisWindow_['focused']) || // If it's the one recieving focus and didn't have it before.
          (!shouldBeFocused && thisWindow_['focused'])) { // If it's not the one recieving focus and did have it before

        console.log('Cambio de focus en el mismo workspace:', thisWindow_);

        thisWindow_['focused'] = shouldBeFocused;
        this.db_.addToStore([thisWindow_]);

      }

    } else if (shouldBeFocused) { // If it's the one recieving focus, but was in another workspace.

      var prevWS = thisWindow_['ws'];
      console.log('Moving Window ID:', thisWindow_['id'], 'from ws:',
          prevWS, 'to Ws', this.currentWorkspace_);

      thisWindow_['ws'] = this.currentWorkspace_;
      thisWindow_['focused'] = true;
      this.db_.addToStore([thisWindow_]);

      goog.array.some(this.windows_, (thisWin_, i, a) => {
        if (thisWin_['ws'] == prevWS) {
          console.log('Found thisWin_ to give focus', thisWin_);
          thisWin_['focused'] = true;
          this.db_.addToStore([thisWin_]);
          // this.windows_[i]['focused'] = true;
          // this.db_.addToStore([this.windows_[i]]);

          return true;
        } else {
          return false;
        }
      });
    }
  });
}



/**
 * @desc Waits Chrome to reload all windows after a restart
 * @private
 */
 // TODO(): Should resolve if there's 1 window with 1 tab other than home page.
 //         There's currently no API to see what's set as home page (new tab).
 // TODO(): Wait until all windows have loaded, if not, it only grabs 1st
 // element of the DB Or is it cause it takes some time for indexedDB to be ready?
chromewm.background.prototype.waitForWindows_ = function() {
  DEBUG_CALLS && console.log('CALL: waitForWindows_()');

  return new Promise((resolve, reject) => {
    var timer = setInterval( () => {
      chrome.windows.getAll({'populate': true}, (windows_) => {
        if ((windows_.length > 1) ||
            (windows_[0]['tabs'].length > 1)) {
          clearInterval(timer);
          this.db_.getAllByStore('windows')
            .then(resolve)
            .catch(reject);
        }
      });
    }, 1000);

    setTimeout(reject, 10 * 60 * 1000); // Stops Trying after 10 minutes
  });
}



/**
 * @desc Updates the entry for windowId in this.windows_ and this.db_
 * @private
 * @param {!number} windowId
 */
chromewm.background.prototype.updateWindow_ = function(windowId) {
  DEBUG_CALLS && console.log('CALL: updateWindow_(', windowId, ')');

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
          // chrome.notifications.clear(notificationId_);}, 2000);
          chrome.notifications.clear(notificationId_);}, 4000);
  });

  chrome.browserAction.setIcon({
    'path': "icon-38-" + newWorkspace + ".png"
  });
}


/**
 * @desc Switches to new workspace
 * @private
 * @param {!string} command
 */
chromewm.background.prototype.changeWorkspace_ = function(command) {
  DEBUG_CALLS && console.log('CALL: changeWorkspace_(',command,')');

  if (command == "ws-next" && this.currentWorkspace_ < this.maxWorkspaces_) {
    this.showWorkspace_(this.currentWorkspace_ + 1);
  } else if (command == "ws-prev" && this.currentWorkspace_ > 1) {
    this.showWorkspace_(this.currentWorkspace_ - 1);
  }
}

// testFunc = function(windowId) {
//   this.handleWindowFocusChange_(windowId);
// }

/**
 * @desc Shows the specified workspace
 * @private
 * @param {!number} newWorkspace
 */
 //TODO(): Need to suspend chrome.windows.onFocusChanged while switching.
chromewm.background.prototype.showWorkspace_ = function(newWorkspace) {
  DEBUG_CALLS && console.log('CALL: showWorkspace_(',newWorkspace,')');

  console.log('switchingWS to true');

  this.switchingWS_ = true;

  if (!(newWorkspace >= 1 && newWorkspace <= this.maxWorkspaces_)) {
    return;
  }
  var windowIdInFocus;
  var newWindowHash = goog.string.hashCode('1' + 'chrome://newtab/');

  goog.array.forEach(this.windows_, (thisWindow_,i,a) => {
    if (thisWindow_['ws'] == this.currentWorkspace_) {
      if (thisWindow_['tabs'] == newWindowHash) {
        DEBUG_WS && console.log('WS: REMOVING:', thisWindow_);
        chrome.windows.remove(thisWindow_['id']);
      } else {
        DEBUG_WS && console.log('WS: HIDING:', thisWindow_);
        chrome.windows.update(thisWindow_['id'], {'state': 'minimized'});
      }
    } else if (thisWindow_['ws'] == newWorkspace) {
      DEBUG_WS && console.log('WS: SHOWING:', thisWindow_);
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

  // verify
  var timer = setInterval( async () => {
    console.log('Checking if windows are updated');
    if (await this.didWindowsUpdate_()) {
      console.log('They are updated!');
      clearInterval(timer);
      this.switchingWS_ = false;
    };
  }, 500);

}


chromewm.background.prototype.didWindowsUpdate_ = function() {
  return new Promise((resolve) => {
  chrome.windows.getAll((windows_) => {
    resolve (goog.array.every(windows_, (window_, i, a) => {
      return (goog.array.some(this.windows_, (thisWindow_, i_, a_) => {
        if(thisWindow_['id'] == window_['id']) {
          console.log('checking window id', thisWindow_['id']);
          if (thisWindow_['ws'] != this.currentWorkspace_) {
            if (!window_['focused']) {
              console.log('meets condition 1');
              return true;
            }
          }
          if (thisWindow_['ws'] == this.currentWorkspace_) {
            if (window_['state'] != 'minimized') {
              console.log('meets condition 2');
              return true;
            }
          }
          return false;
        }
        return false;
      }));
    }));
  });
});
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
  DEBUG_CALLS && console.log('CALL: tileWindow_(',movement,')');

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
 * @return {!Promise}
 */
chromewm.background.prototype.getDisplayWorkArea_ = function(windowId) {
  DEBUG_CALLS && console.log('CALL: getDisplayWorkArea_(',windowId,')');

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
          reject("Failed to getDisplayWorkArea_");
        }
      });
    });
  });
}


/////////////////////////////////////////////
//       Core functions                    //
/////////////////////////////////////////////
/**
* @desc Handles keyboard commands
* @private
* @param {!string} command
*/
chromewm.background.prototype.commandHandler_ = function(command) {
  DEBUG_CALLS && console.log('CALL: commandHandler_(',command,')');

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
/** @type {chromewm.background} background */
var background = new chromewm.background();
background.Init();
