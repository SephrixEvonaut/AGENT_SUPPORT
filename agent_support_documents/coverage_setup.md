# Interception Driver Setup Guide

The Interception driver enables kernel-level input injection that is **much harder to detect** than the default RobotJS backend. This is the recommended setup for games with sophisticated anti-cheat systems.

## Detection Comparison

| Backend | Detection Risk | How It Works |
|---------|---------------|--------------|
| RobotJS | Medium | Uses Windows SendInput API, sets LLKHF_INJECTED flag |
| Interception | Low | Kernel driver, input appears as hardware |
| Hardware Emulator | None | Arduino/USB HID (Phase 3, future) |

## Prerequisites

- Windows 10 or 11 (64-bit)
- Administrator access
- Visual C++ Redistributable 2015-2022

## Step 1: Download Interception Driver

1. Go to: https://github.com/oblitum/Interception/releases
2. Download the latest `Interception.zip`
3. Extract to a folder (e.g., `C:\Interception`)

## Step 2: Install the Driver

Open **Command Prompt as Administrator** and run:

```cmd
cd C:\Interception\command line installer

:: Install the driver
install-interception.exe /install

:: Reboot is required
shutdown /r /t 0
```

After reboot, verify installation:

```cmd
:: Should show installed devices
install-interception.exe /list
```

## Step 3: Copy DLL to System

Copy the Interception DLL to the expected location:

```cmd
mkdir "C:\Program Files\Interception\library\x64"
copy "C:\Interception\library\x64\interception.dll" "C:\Program Files\Interception\library\x64\"
```

## Step 4: Install Node.js FFI Modules

The Interception executor uses FFI to call the native DLL:

```cmd
cd local-macro-agent
npm install ffi-napi ref-napi
```

**Note:** These packages require native compilation tools:
- Install Visual Studio Build Tools
- Or: `npm install --global windows-build-tools`

## Step 5: Run with Interception Backend

```cmd
:: Explicit backend selection
npm start -- --backend=interception

:: Or set environment variable
set MACRO_BACKEND=interception
npm start
```

## Step 6: Verify It's Working

When starting with Interception, you should see:

```
[ExecutorFactory] Creating Interception executor (kernel-level)
[ExecutorFactory] Detection level: HARD (appears as hardware input)
[InterceptionExecutor] Using keyboard device: 1
[InterceptionExecutor] Initialized successfully (kernel-level injection ready)

Executor backend: INTERCEPTION
```

## Troubleshooting

### "Failed to create context"

- Driver not installed properly
- Need to reboot after installation
- Run as Administrator

### "Cannot find module 'ffi-napi'"

```cmd
npm install ffi-napi ref-napi
```

If that fails, install build tools:
```cmd
npm install --global windows-build-tools
```

### "DLL not found"

Ensure the DLL is at:
```
C:\Program Files\Interception\library\x64\interception.dll
```

Or specify custom path:
```js
const executor = new InterceptionExecutor('D:\\custom\\path\\interception.dll');
```

### Games Still Detecting Input

Some anti-cheat systems monitor all keyboard devices. If Interception is still detected:

1. **Try different keyboard device**: The executor uses device 1 by default, but your physical keyboard might be on a different device number.

2. **Use hardware emulator** (Phase 3): Arduino/USB HID is completely undetectable because it's actual hardware.

## Security Notes

- Interception driver is signed and safe
- Used by many legitimate applications (AutoHotkey, etc.)
- Open source: https://github.com/oblitum/Interception
- Does NOT modify game files

## Uninstalling

To remove the driver:

```cmd
cd C:\Interception\command line installer
install-interception.exe /uninstall
shutdown /r /t 0
```

## Backend Selection Summary

```cmd
:: Auto-select best available (prefers Interception > RobotJS > Mock)
npm start

:: Force specific backend
npm start -- --backend=robotjs
npm start -- --backend=interception
npm start -- --backend=mock

:: Show what's available
npm start -- --backends

:: Set default via environment
set MACRO_BACKEND=interception
npm start
```

## Next Steps

Once Interception is working:

1. Test with your game to verify inputs work
2. Monitor for any detection issues
3. If still detected, consider Phase 3 (hardware emulator)

## Phase 3 Preview: Hardware Emulator

For games with kernel-level anti-cheat that detect even Interception:

- Arduino Leonardo/Pro Micro as USB HID device
- Python script sends commands over serial
- Arduino acts as "real" USB keyboard
- **100% undetectable** - it IS real hardware

This will be implemented in a future phase if Interception proves insufficient.
