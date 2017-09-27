# Chrome Windows Manager
## Overview:
This Chrome browser extension provides two windows management functions:
- Tiling windows.
- Emulating workspaces

## Features
- Multi-monitor support.
- Emulates up to 9 workspaces.
- Tiles windows to 8 different positions. (4 corners + 4 split screen)
- Remembers the windows workspace assignment between system reboots.
- Allows to define custom keyboard shortcuts.
- Multi-platform support: ChromeOS, Linux, Mac and Windows.

### Required Permissions
- **Display Notifications**: To Notify when switching to another workspace.
- **Read your browsing history**: To recover each window's workspace assignment
after a reboot or browser restart.  
It creates a unique hash number for each window based on the amount of tabs open and the url of the last tab.

## Use Guide
### Install and Configure
1. Install from the [Chrome Webstore](https://chrome.google.com/webstore/detail/chrome-windows-manager/gophpkegccafhjahoijdembdkbjpiflb)
2. Click on the extension icon on the toolbar.
3. Select the amount of workspaces by using the slider.
4. Click on the 'Configure shortcuts' button.
5. Configure the keyboard shortcuts to switch workspaces.
  - I recommend using `Alt+X` and `Alt+Z`.
  - Set the workspace shortcuts scope to *global*, so you can switch them without Chrome being in focus.


### Normal Use
##### Tile Windows
  With the Chrome Browser window in focus, use the configured keyboard shortcuts to tile it to different positions.
##### Switch Workspaces:
  1. Press the *Next Workspace* or *Previous Workspace* keyboard shortcut.
  2. A notification will be displayed indicating which workspace is now active.  
  NOTE: The extension icon will always display the active workspace.

##### Move a window to another workspace:
  1. Switch to the destination workspace.
  2. Bring the window to focus using `Alt+Tab`, or another native window management
  function of the native Operative System.  

## Known Limitations
- Does not recover the workspaces state if the browser crashes due to a power
loss or the process being terminated. (See issue #1)
- Cannot set all shortcuts by default do to an imposed limit of 4 by Chrome.
- It's necessary to open a new Chrome window when switching to an empty workspace,
in order for Chrome to be in focus and able to listen for keyboard shortcuts.
(The window will be removed if it's not used)


## About the Code
I did this cause there are no workspaces in ChromeOS, I'm not a developer (2nd thing I do in JS), but
I'll try to keep improving the code as I learn Javascript.
Check [this link](https://xkcd.com/1513) for more information.

### Dependencies
The code compiles in linux and uses the Google Closure library and compiler.  
I would eventually modify the builder so it's not necessary to grab those dependencies
(see issue #3), but for now, you can get them from their project pages:
- [Closure Compiler](https://github.com/google/closure-compiler)  
It needs OpenJDK, so look for the package in your distro.

- [Closure Library](https://github.com/google/closure-library)


### Compiling
1. Clone the repository: `git clone https://github.com/EduCampi/chromewm.git`
2. Edit the `build.sh` file.
3. Replace the first section with the paths to the Closure Compiler .jar file,
Closure Library, and the externs files inside the Closure Compiler repository.
4. Save and execute the `build.sh` file.
5. The built package will be located at the `bin` directory.
