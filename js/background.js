/**
 * @fileoverview Background file
 * @author EduCampi
 */

// TODO(): Implement Promises properly, resolve and reject
// TODO(): Cleanup and improve code quality
// TODO(): Move windows to other workspaces (alt+tab?)
// TODO(): Improve/fix Initialization after crash

goog.provide('chromewm.background');

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
  /** @private {Array} windows_ */
  this.windows_ = [];
  /** @private {number} maxWorkspaces_ */
  this.maxWorkspaces_;
  /** @private {number} currentWorkspace_ */
  this.currentWorkspace_;
  /** @private {Object} storage_ */
  this.storage_;
}

/**
* @desc Initializes the Main object
*/
//TODO(): Restore saved this.windows_ ?
chromewm.background.prototype.Init = async function() {
  /** Initializes properties */
  this.currentWorkspace_ = 1;

  this.storage_ = new goog.storage.mechanism.HTML5LocalStorage();

  this.maxWorkspaces_ = parseInt(this.storage_.get('workspaceQty_'),10) || 1;
  // this.storage_.clear();
  // this.maxWorkspaces_ = 3;
  // Waits for Windows to reload after a Chrome crash.
  var waitW = await this.waitForWindows_();
  console.log('INIT: Found Windows', waitW);

  // Recovers saved Windows and Workspaces and shows workspace 1
  this.getWindowsFromStorage_().then(savedWindows_ => {
    chrome.windows.getAll({'populate': true}, (windows_) => {
      goog.array.forEach(windows_, (window_,i,a) => {
        goog.array.forEach(savedWindows_, (sW_, sI, sA) => {

          if (sW_.tabs == goog.string.hashCode(window_.tabs.length.toString() +
              goog.array.last(window_.tabs).url)) {

            this.windows_.push({
              id: window_.id,
              state: sW_.state,
              focused: sW_.focused,
              tabs: sW_.tabs,
              workspace: sW_.workspace
            });
            //TODO():Replace by this.showWorkspace_()
            //TODO():Update local storage (remove old, add new)
            if (sW_.workspace == 1) {
              chrome.windows.update(window_.id, {focused: true});
            } else {
              chrome.windows.update(window_.id, {state: 'minimized'});
            }
          }
        });
      });
      console.log('INIT this.windows_', this.windows_);
      console.log('INIT windows_', windows_);
    });
  }).catch( () => {
    console.log('INIT: Unable to load saved windows_');}
  );


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

  chrome.tabs.onMoved.addListener( (windowId, fromIndx, toIndx) => {
    this.updateWindow_(windowId);
  });

  //TODO(): What if create a new window while attaching
  chrome.tabs.onAttached.addListener( (tabId, attachInfo) => {
    this.updateWindow_(attachInfo.newWindowId);
  });

  //TODO(): Posibility for window being removed
  chrome.tabs.onDetached.addListener( (tabId, detachInfo) => {
    this.updateWindow_(detachInfo.oldWindowId);
  });

  chrome.tabs.onRemoved.addListener( (tabId, removeInfo) => {
      this.updateWindow_(removeInfo.windowId);

  });

  chrome.windows.onRemoved.addListener( (windowId) => {
    goog.array.removeIf(this.windows_, (thisWindow_,i,a) => {
      return thisWindow_.id == windowId;
    });
    this.removeWindowFromStorage_(windowId);
  });

  chrome.commands.onCommand.addListener( (command) => {
      this.commandListener_(command);
    });

}


/**
 * @desc Updates the tabs hash in this.windows_ and this.storage_
 * for the provided windowId
 * @private
 * @param {number} windowId
  */
// TODO(): Doesn't work if thisWindow_ is not populated.
// (never switched workspaces so it was never saved.
// Will it work with right Init function?)
chromewm.background.prototype.updateWindow_ = function(windowId) {
  console.log('windowId', windowId);

  // TODO(): Check if exists in thisWindow_, if it does, update.
  // There's a race condition, as the windows.onRemoved doesn't get to
  // delete the window from this.windows_ before I check it here.
  // Deberia poder verificar si existe la window_ usando chrome.windows,get
  // pero parece tirar un falso positivo.
  if (goog.array.find(this.windows_, (thisWindow_,indx,a) => {
      return thisWindow_.id == windowId;})) {
    console.log('Found in this.Windows_');

    chrome.windows.get(windowId, {populate: true}, (window_) => {
      var tabs = goog.string.hashCode(
          window_.tabs.length.toString() +
          goog.array.last(window_.tabs).url);
      goog.array.some(this.windows_, (thisWindow_, indx, a) => {
        if (thisWindow_.id == windowId && thisWindow_.tabs != tabs) {
          console.log('thisWindow_', thisWindow_);
          console.log('tabs', tabs);
          this.windows_[indx].tabs = tabs;
          this.storage_.set(windowId.toString() + '-tabs', tabs);
          return true;
        }
        return false;
      });
    });
  }
}

//TODO(): Para que funcione esto, tengo que tener actualizadas las windows todo el tiempo
chromewm.background.prototype.Init2 = function() {
  return new Promise(resolve => {
    this.getWindowsFromStorage_().then(savedWindows_ => {
      var savedLength = savedWindows_.length;
      var timer = setInterval( () => {
        chrome.windows.getAll((windows_) => {
          if (windows_.length >= savedLength) {
            clearInterval(timer);
            resolve();
          }
        });
      }, 500);
    });
  });
}


/**
 */
chromewm.background.prototype.waitForWindows_ = function() {
  return new Promise(resolve => {
    var timer = setInterval( () => {
      //TODO(): Something that allows to go on if it starts from scratch
      // Should wait if the current amount of windows is less than saved
      // Or if saved equals 1 with 1 tabs.lenght or less, then enable extension
      chrome.windows.getAll((windows_) => {
        var largo = windows_.length;
        if (largo > 1) {
          clearInterval(timer);
          resolve(largo);
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
            id: prefixNumber,
            focused: this.storage_.get(windowId + '-focused'),
            state: this.storage_.get(windowId + '-state'),
            tabs: this.storage_.get(windowId + '-tabs'),
            workspace: this.storage_.get(windowId + '-workspace')
          });
        }
      }
      catch(err) {
        break;
      }
    }
    if (windows_.length > 0) {
      resolve(windows_);
    } else {
      reject();
    }
  });
}




////////////////////////////////////////////
//            Workspaces Logic            //
////////////////////////////////////////////

/** TODO(): Check using goog.array.insert() to add windows
 * @desc Populates this.windows_ with windows in currentWorkspace
 * @private
 * @return {Promise}
 */
chromewm.background.prototype.getWorkspaceWindows_ = function() {
  DEBUG_CALLS && console.log('getWorkspaceWindows_()');

  var newWindowHash = goog.string.hashCode('1' + 'chrome://newtab/');

  return new Promise((resolve, reject) => {
    chrome.windows.getAll({'populate': true}, (windows_) => {

      // Removes closed windows from this.windows_
      goog.array.removeAllIf(this.windows_, (thisWindow_,i,a) => {
        var foundWindow = goog.array.find(windows_, (w,i,a) => {
            return w.id == thisWindow_.id;});

        if (!foundWindow) {
          this.removeWindowFromStorage_(thisWindow_.id);
          return true;
        }
        return false;
      });

      // Adds new windows_ to this.windows_
      goog.array.forEach(windows_, (window_,i,a) => {
        var windowHash_ = goog.string.hashCode(
            window_.tabs.length.toString() +
            goog.array.last(window_.tabs).url);

        if (windowHash_ == newWindowHash) {
          chrome.windows.remove(window_.id);
        } else {
          var foundWindow = goog.array.find(this.windows_, (thisWindow_,i,a) => {
              return thisWindow_.id == window_.id;});

          if (!foundWindow
              || (foundWindow.workspace == this.currentWorkspace_
                && (foundWindow.focused != window_.focused
                || foundWindow.state != window_.state
                || foundWindow.tabs != windowHash_))) {
            var windowToSave = {
                focused: window_.focused,
                id: window_.id,
                state: window_.state,
                tabs: goog.string.hashCode(
                    window_.tabs.length.toString() +
                    goog.array.last(window_.tabs).url),
                workspace: this.currentWorkspace_        // If I use concurrency, maybe I need to store this in local variable
            };
            this.windows_.push(windowToSave);
            this.saveWindowToStorage_(windowToSave);
          }
        }
      });
      resolve();
    });
  });
}


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


/** DONE
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

  this.getWorkspaceWindows_().then( () => {
    goog.array.forEach(this.windows_, (window_,i,a) => {
      if (window_.workspace == this.currentWorkspace_) {
        DEBUG_WS && console.log('HIDING:', window_);
        chrome.windows.update(window_.id, {state: 'minimized'});
      } else if (window_.workspace == newWorkspace) {
        DEBUG_WS && console.log('SHOWING:', window_);
        chrome.windows.update(window_.id, {focused: true});
        if (window_.focused) {
          windowIdInFocus = window_.id;
        }
      }
    });
    if (typeof windowIdInFocus === 'undefined') {
      chrome.windows.create({url: "chrome://newtab/", state: 'maximized'});
    } else {
      chrome.windows.update(windowIdInFocus, {focused: true});
    }
    this.currentWorkspace_ = newWorkspace;
    this.showWsTransition_(newWorkspace);
  });
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
  this.storage_.set(windowIdStr + '-tabs', thisWindowObj.tabs);
  this.storage_.set(windowIdStr + '-workspace', thisWindowObj.workspace);
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
