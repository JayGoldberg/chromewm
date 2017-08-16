/**
 * @fileoverview Background file
 * @author EduCampi
 */

// TODO(): Implement Promises properly, resolve and reject
// TODO(): Cleanup and improve code quality
// TODO(): Improve/fix Initialization after crash
// TODO(): Initialization. Need to get all Windows on this.windows_ when starting from scratch (extension installation)
// TODO(): Can assign per reference, see what can be improved.
goog.provide('chromewm.background');

goog.require('goog.array');
goog.require('goog.events');
goog.require('goog.object');
goog.require('goog.storage.mechanism.HTML5LocalStorage');
goog.require('goog.string');


var DEBUG_CALLS = true; // Logs Method calls.
var DEBUG_WS = false; // Debugs Workspaces


////////////////////////////////////////////
//          Initialization Logic          //
////////////////////////////////////////////

/**
 * @desc Defines main object
 * @constructor @export
 */
chromewm.background = function() {
  /** @private {Array} windows_ */
  this.windows_ = [];
  /** @private {number} maxWorkspaces_ */
  this.maxWorkspaces_ = 1;
  /** @private {number} currentWorkspace_ */
  this.currentWorkspace_ = 0;
  /** @private {Object} storage_ */
  this.storage_ = new goog.storage.mechanism.HTML5LocalStorage();
}


/**
* @desc Initializes the Main object
*/
chromewm.background.prototype.Init = async function() {

  this.maxWorkspaces_ = goog.string.parseInt(
      this.storage_.get('workspaceQty_')) || 1;

  // Waits for Windows to reload after a Chrome crash.
  var waitW = await this.waitForWindows_();
  console.log('INIT 1 Found Windows', waitW);

  this.getWindowsFromStorage_().then(savedWindows_ => {
    console.log('INIT 2 savedWindows_', savedWindows_);

    chrome.windows.getAll({'populate': true}, (windows_) => {
      console.log('INIT 3 windows_', windows_);
      goog.array.forEach(windows_, (window_,i,a) => {
        var windowToSave_ = [];
        var tabs_ = goog.string.hashCode(
            window_.tabs.length.toString() +
            goog.array.last(window_.tabs).url);

        if (!goog.array.some(savedWindows_, (sW_, sI, sA) => {
            if (sW_.tabs == tabs_) {
              windowToSave_ = {
                focused: sW_.focused,
                id: window_.id,
                state: sW_.state,
                tabs: sW_.tabs,
                workspace: sW_.workspace
              };
              return true;
            } else {
              return false;
            }
            })) {
          windowToSave_ = {
            focused: window_.focused,
            id: window_.id,
            state: window_.state,
            tabs: tabs_,
            workspace: 1
          };
        }
        this.windows_.push(windowToSave_);
      });
      console.log('INIT 4 this.windows_', this.windows_);

    console.log('INIT 5 updating storage');
    this.showWorkspace_(1);
    this.storage_.clear();
    this.storage_.set('workspaceQty_', this.maxWorkspaces_);
    goog.array.forEach(this.windows_, (thisWindow_, i, a) => {
      this.saveWindowToStorage_(thisWindow_);
    });


    console.log('INIT 6 start listeners');
    goog.events.listen(
      window,
      goog.events.EventType.STORAGE,
      (e) => {
        this.maxWorkspaces_ = goog.string.toNumber(e.event_.newValue);
      }
    );

    chrome.tabs.onUpdated.addListener( (tabId, changeInfo, tab) => {
      if (changeInfo.status == "complete") {
        this.updateWindow_(tab.windowId);
      }
    });

    chrome.tabs.onMoved.addListener( (tabId, moveInfo) => {
      this.updateWindow_(moveInfo.windowId);
    });

    chrome.tabs.onAttached.addListener( (tabId, attachInfo) => {
      this.updateWindow_(attachInfo.newWindowId);
    });

    chrome.tabs.onDetached.addListener( (tabId, detachInfo) => {
      this.updateWindow_(detachInfo.oldWindowId);
    });

    chrome.tabs.onRemoved.addListener( (tabId, removeInfo) => {
        this.updateWindow_(removeInfo.windowId);
    });

    // TODO(): MAke this listener pretier
    chrome.windows.onFocusChanged.addListener( (windowId) => {
      if (windowId != chrome.windows.WINDOW_ID_NONE) {
        goog.array.forEach(this.windows_, (thisWindow_, i, a) => {
          var shouldBeFocused = (thisWindow_.id == windowId);
          if (thisWindow_.workspace == this.currentWorkspace_) {
            if (shouldBeFocused || thisWindow_.focused) {
              thisWindow_.focused = shouldBeFocused;
              this.storage_.set(thisWindow_.id.toString() + '-focused',
                  shouldBeFocused);
            }
          } else if (shouldBeFocused) {
            thisWindow_.workspace = this.currentWorkspace_;
            this.storage_.set(thisWindow_.id.toString() + '-workspace',
                this.currentWorkspace_);
          }
        });
      }
    });

    chrome.commands.onCommand.addListener( (command) => {
        this.commandListener_(command);
    });

  });
});
}


//TODO(): For this to work, need to ensure Init populates this.windows_ on first run.
chromewm.background.prototype.waitForWindows_2 = function() {
  return new Promise(resolve => {
    this.getWindowsFromStorage_().then(savedWindows_ => {
      var savedLength = savedWindows_.length;

      var timer = setInterval( () => {
        chrome.windows.getAll((windows_) => {
          if (windows_.length >= savedLength) {
            clearInterval(timer);
            resolve(4);
          }
        });
      }, 500);
    });
  });
}

//
/**
 */
chromewm.background.prototype.waitForWindows_ = function() {
  return new Promise(resolve => {

    var timer = setInterval( () => {
      chrome.windows.getAll((windows_) => {
        var windowsQty = windows_.length;
        if (windowsQty > 1) {
          clearInterval(timer);
          resolve(windowsQty);
        }
      });
    }, 500);
  });
}


/**
 * @desc Gets Windows from this.storage_
 * @private
 * @return {Promise}
 */
chromewm.background.prototype.getWindowsFromStorage_ = function() {
  return new Promise((resolve, reject) => {
    var storageIterator = this.storage_.__iterator__(true);
    var windows_ = [];
    var prefixNumber, windowId;

    while (true) {
      try{
        prefixNumber = goog.string.parseInt(storageIterator.next(true));
        if (!isNaN(prefixNumber) && prefixNumber != windowId) {
          windowId = prefixNumber.toString();
          goog.array.insert(windows_, {
            focused: String(this.storage_.get(windowId + '-focused')) == 'true',
            id: prefixNumber,
            state: this.storage_.get(windowId + '-state'),
            tabs: goog.string.parseInt(
                this.storage_.get(windowId + '-tabs')),
            workspace: goog.string.parseInt(
                this.storage_.get(windowId + '-workspace')) || 1
          });
        }
      }
      catch(err) {
        break;
      }
    }
    resolve(windows_);
  });
}


/**
 * @desc Updates the entry for windowId in this.windows_ and this.storage_
 * @private
 * @param {!number} windowId
 */
chromewm.background.prototype.updateWindow_ = function(windowId) {
  DEBUG_CALLS && console.log('updateWindow_ ', windowId);

  chrome.windows.get(windowId, {populate: true}, (window_) => {
    if (window_.tabs.length == 0) {
      goog.array.removeIf(this.windows_, (thisWindow_,i,a) => {
        return thisWindow_.id == windowId;
      });
      this.removeWindowFromStorage_(windowId);
    } else {
      var tabs_ = goog.string.hashCode(
          window_.tabs.length.toString() +
          goog.array.last(window_.tabs).url);
      if (!goog.array.some(this.windows_, (thisWindow_, indx, a) => {
        if (thisWindow_.id == windowId) {
          if (thisWindow_.tabs != tabs_) {
            this.windows_[indx].tabs = tabs_;
            this.storage_.set(windowId.toString() + '-tabs', tabs_);
          }
          return true;
        } else {
          return false;
        }
      })) {
        var windowToSave = {
            focused: window_.focused,
            id: window_.id,
            state: window_.state,
            tabs: tabs_,
            workspace: this.currentWorkspace_
        };
        console.log('WINDOW TO SAVE', windowToSave);
        this.windows_.push(windowToSave);
        this.saveWindowToStorage_(windowToSave);
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
 * @param {number} newWorkspace
 */
chromewm.background.prototype.showWsTransition_ = function(newWorkspace) {
  chrome.notifications.create("workspaceChange", {
      type: "basic",
      title: "\rWorkspace " + newWorkspace,
      message: "",
      iconUrl: "icon-64-" + newWorkspace + ".png",
      priority: 2
      },
      (notificationId_) => {
        setTimeout(() => {
          chrome.notifications.clear(notificationId_);}, 2000);
  });

  chrome.browserAction.setIcon({
    path: "icon-38-" + newWorkspace + ".png"
  });
}


/** DONE
 * @desc Switches to new workspace
 * @private
 * @param {string} command
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
 *  //TODO(): Kill and start window onFocus listener
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
    if (thisWindow_.workspace == this.currentWorkspace_) {
      if (thisWindow_.tabs == newWindowHash) {
        chrome.windows.remove(thisWindow_.id);
        DEBUG_WS && console.log('REMOVING:', thisWindow_);
      } else {
        DEBUG_WS && console.log('HIDING:', thisWindow_);
        chrome.windows.update(thisWindow_.id, {state: 'minimized'});
      }
    } else if (thisWindow_.workspace == newWorkspace) {
      DEBUG_WS && console.log('SHOWING:', thisWindow_);
      chrome.windows.update(thisWindow_.id, {focused: true});
      if (thisWindow_.focused) {
        windowIdInFocus = thisWindow_.id;
      }
    }
  });
  if (typeof windowIdInFocus === 'undefined') {
    chrome.windows.create({url: "chrome://newtab/", state: 'maximized'});
  } else {
    chrome.windows.update(windowIdInFocus, {focused: true});
  }
  console.log('UPDATING this.currentWorkspace_');
  this.currentWorkspace_ = newWorkspace;
  this.showWsTransition_(newWorkspace);
  console.log('AND this.windows_ is', this.windows_);
}




////////////////////////////////////////////
//          Tiling Windows Logic          //
////////////////////////////////////////////

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
          return (window_.left < (display.workArea.left+display.workArea.width))
            && (window_.top < (display.workArea.top + display.workArea.height))
        });
        if (goog.object.containsKey(displayInFocus, 'workArea')) {
          resolve(displayInFocus.workArea)
        } else {
          reject(Error("Failed to getDisplayWorkArea_"));
        }
      });
    });
  });
}


/**
 * @desc Tiles window
 * @private
 * @param {string} movement
 */
chromewm.background.prototype.tileWindow_ = function(movement) {
  DEBUG_CALLS && console.log('tileWindow_(',movement,')');

  var newSize = {};
  chrome.windows.getLastFocused((window_) => {
    this.getDisplayWorkArea_(window_.id).then((workArea) => {
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
          console.log('ERROR: Unrecognized command recieved in tileWindow_: ',
              movement);
          return;
      };

      if (window_.state == 'maximized') {
        chrome.windows.update(window_.id, {state: 'normal'});
      }
      chrome.windows.update(window_.id, newSize);
    });
  });
}




/////////////////////////////////////////////
//  Core functions: Storage and Listeners  //
/////////////////////////////////////////////

/** DONE
* @desc Handles keyboard commands
* @private
* @param {string} command
*/
chromewm.background.prototype.commandListener_ = function(command) {
  DEBUG_CALLS && console.log('commandListener_(',command,')');

  if (goog.string.startsWith(command, 'tile-')) {
    this.tileWindow_(command);
    return;
  }
  if (goog.string.startsWith(command, 'ws-')) {
    this.changeWorkspace_(command);
    return;
  }
}


/** DONE
 * @desc Adds a window to the local Storage (this.storage_)
 * @private
 * @param {!Object} thisWindowObj
 */
chromewm.background.prototype.saveWindowToStorage_ = function(thisWindowObj) {
  DEBUG_CALLS && console.log('saveWindowToStorage_(',thisWindowObj,')');

  var windowIdStr = thisWindowObj.id.toString();
  this.storage_.set(windowIdStr + '-focused', thisWindowObj.focused);
  this.storage_.set(windowIdStr + '-state', thisWindowObj.state);
  this.storage_.set(windowIdStr + '-tabs',
      goog.string.parseInt(thisWindowObj.tabs));
  this.storage_.set(windowIdStr + '-workspace',
      goog.string.parseInt(thisWindowObj.workspace));
}


/** DONE
 * @desc Removes a window from the local Storage (this.storage_)
 * @private
 * @param {!number} windowId
 */
chromewm.background.prototype.removeWindowFromStorage_ = function(windowId) {
  DEBUG_CALLS && console.log('removeWindowFromStorage_(',windowId,')');

  var windowIdStr = windowId.toString();
  this.storage_.remove(windowIdStr + '-focused');
  this.storage_.remove(windowIdStr + '-state');
  this.storage_.remove(windowIdStr + '-tabs');
  this.storage_.remove(windowIdStr + '-workspace');
}


/** DONE
 * Create and start extension
 */
/** @type {chromewm.background} backgroundMain */
var backgroundMain = new chromewm.background();
backgroundMain.Init();
