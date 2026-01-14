# SWTOR Vengeance Juggernaut - Output Keybind Reference

A complete list of all output keys used in ability sequences. This document is separate from the manifest system and serves as a quick reference for SWTOR in-game keybind configuration.

---

## 🎮 Combat Abilities

| Ability        | Output Key | Notes                    |
| -------------- | ---------- | ------------------------ |
| Crushing Blow  | `N`        | Primary rotation ability |
| Force Scream   | `O`        | High damage ability      |
| Aegis Assault  | `Z`        | Tank rotation filler     |
| Vicious Throw  | `[`        | Execute ability          |
| Saber Throw    | `SHIFT+M`  | Ranged attack            |
| Vicious Slash  | `SHIFT+L`  | Filler ability           |
| Sweeping Slash | `SHIFT+J`  | AOE attack               |
| Retaliation    | `R`        | Proc-based counterattack |
| Smash          | `]`        | AOE slam                 |
| Basic Attack   | `SHIFT+Q`  | Auto-attack              |
| Ravage         | `SHIFT+K`  | Channeled ability        |

---

## 🗡️ Offensive Cooldowns

| Ability         | Output Key | Notes                 |
| --------------- | ---------- | --------------------- |
| Backhand        | `ALT+R`    | Interrupt alternative |
| Force Choke     | `SHIFT+Z`  | Channeled CC          |
| Seismic Grenade | `ALT+J`    | Ranged AOE            |

---

## 🛡️ Defensive Abilities

| Ability         | Output Key | Notes                    |
| --------------- | ---------- | ------------------------ |
| Saber Ward      | `,`        | Main defensive           |
| Invincible      | `ALT+M`    | Immunity cooldown        |
| Enraged Defense | `SHIFT+.`  | Self-heal defensive      |
| Endure Pain     | `SHIFT+,`  | HP buffer                |
| Stun Break      | `SHIFT+V`  | CC break                 |
| Mad Dash        | `ALT+Q`    | Mobility/damage immunity |

---

## 🏃 Movement & Mobility

| Ability    | Output Key | Notes      |
| ---------- | ---------- | ---------- |
| Leap       | `F9`       | Gap closer |
| Intercede  | `;`        | Ally leap  |
| Jump       | `NUMPAD0`  | Basic jump |
| Force Push | `ALT+L`    | Knockback  |

---

## 🎯 Taunts

| Ability             | Output Key | Notes         |
| ------------------- | ---------- | ------------- |
| Single Target Taunt | `F6`       | Primary taunt |
| Mass Taunt          | `F7`       | AOE taunt     |
| Enrage              | `F8`       | Rage builder  |

---

## 🔒 Crowd Control

| Ability      | Output Key | Notes             |
| ------------ | ---------- | ----------------- |
| Interrupt    | `K`        | Primary interrupt |
| Electro Stun | `ALT+K`    | Hard stun         |

---

## 🎯 Targeting Keys

| Function              | Output Key | Notes                  |
| --------------------- | ---------- | ---------------------- |
| Next Enemy            | `V`        | Tab-target next        |
| Previous Enemy        | `SHIFT+N`  | Tab-target previous    |
| Close Enemy           | `Q`        | Nearest enemy          |
| Next Friend           | `.`        | Cycle allies forward   |
| Close Friend          | `'`        | Nearest ally           |
| Target of Target      | `M`        | Assist function        |
| Acquire Center Target | `SHIFT+O`  | Screen-center target   |
| Focus Target's ToT    | `J`        | Focus target's target  |
| Group Member 1        | `NUMPAD1`  | Party frame 1          |
| Group Member 2        | `NUMPAD2`  | Party frame 2          |
| Group Member 3        | `NUMPAD3`  | Party frame 3          |
| Group Member 4        | `NUMPAD7`  | Party frame 4          |
| Target Self           | `NUMPAD9`  | Self-target            |
| Set Focus Target      | `X`        | Mark focus             |
| Focus Target Modifier | `SHIFT+R`  | Cast on focus (prefix) |

---

## 🛡️ Guard System

| Function   | Output Key              | Notes                    |
| ---------- | ----------------------- | ------------------------ |
| Guard Swap | `L` + `NUMPAD_MULTIPLY` | Dual-key with 6ms offset |

---

## 💊 Consumables

| Item               | Output Key       | Notes          |
| ------------------ | ---------------- | -------------- |
| Med Pack           | `ALT+O`          | Health restore |
| Adrenal            | `ALT+N`          | Damage boost   |
| Relic              | `SHIFT+X`        | On-use relic   |
| Out of Combat Heal | `NUMPAD_DECIMAL` | Regen ability  |

---

## 🔧 Utility

| Function       | Output Key  | Notes          |
| -------------- | ----------- | -------------- |
| Escape         | `ESCAPE`    | Cancel casting |
| RP Walk Toggle | `BACKSPACE` | Walk mode      |
| Mute SWTOR     | `END`       | Audio mute     |

---

## 🎨 Icon System Keys

| Icon      | Output Key        | Purpose                            |
| --------- | ----------------- | ---------------------------------- |
| 🎯 Cog    | `NUMPAD_SUBTRACT` | Confirms targeting actions         |
| 🔫 Gun    | `NUMPAD_ADD`      | Confirms focus target actions      |
| 🛡️ Shield | `NUMPAD_MULTIPLY` | Guard swap confirmation (dual-key) |

---

## 🎙️ Discord Controls

| Function       | Output Key     | Notes                     |
| -------------- | -------------- | ------------------------- |
| Mic Toggle     | `CTRL+SHIFT+M` | Mute/unmute mic           |
| Deafen Toggle  | `CTRL+SHIFT+D` | Deafen/undeafen           |
| Volume: Low    | `END`          | Placeholder (Discord API) |
| Volume: Medium | `END`          | Placeholder (Discord API) |
| Volume: High   | `END`          | Placeholder (Discord API) |

---

## ⏱️ Timer System

| Timer      | Output Key | Notes                                                 |
| ---------- | ---------- | ----------------------------------------------------- |
| All Timers | `END`      | Placeholder - actual timer handled by timerManager.ts |

---

## 📊 Keybind Summary by Category

### Standard Keys (A-Z, punctuation)

```
,   - Saber Ward
.   - Next Friend
;   - Intercede
'   - Close Friend
[   - Vicious Throw
]   - Smash
J   - Focus Target's Target of Target
K   - Interrupt
L   - Guard Swap (base key)
M   - Target of Target
N   - Crushing Blow
O   - Force Scream
Q   - Close Enemy
R   - Retaliation
V   - Next Enemy
X   - Set Focus Target
Z   - Aegis Assault
```

### SHIFT+ Modified Keys

```
SHIFT+.   - Enraged Defense
SHIFT+,   - Endure Pain
SHIFT+J   - Sweeping Slash
SHIFT+K   - Ravage
SHIFT+L   - Vicious Slash
SHIFT+M   - Saber Throw
SHIFT+N   - Previous Enemy
SHIFT+O   - Acquire Center Target
SHIFT+Q   - Basic Attack
SHIFT+R   - Focus Target Modifier
SHIFT+V   - Stun Break
SHIFT+X   - Relic
SHIFT+Z   - Force Choke
```

### ALT+ Modified Keys

```
ALT+J   - Seismic Grenade
ALT+K   - Electro Stun
ALT+L   - Force Push
ALT+M   - Invincible
ALT+N   - Adrenal
ALT+O   - Med Pack
ALT+Q   - Mad Dash
ALT+R   - Backhand
```

### CTRL+SHIFT+ Modified Keys

```
CTRL+SHIFT+D   - Discord Deafen Toggle
CTRL+SHIFT+M   - Discord Mic Toggle
```

### Function Keys

```
F6   - Single Target Taunt
F7   - Mass Taunt
F8   - Enrage
F9   - Leap
```

### Numpad Keys

```
NUMPAD0          - Jump
NUMPAD1          - Group Member 1
NUMPAD2          - Group Member 2
NUMPAD3          - Group Member 3
NUMPAD7          - Group Member 4
NUMPAD9          - Target Self
NUMPAD_DECIMAL   - Out of Combat Heal
NUMPAD_SUBTRACT  - Cog Icon (targeting confirm)
NUMPAD_ADD       - Gun Icon (focus confirm)
NUMPAD_MULTIPLY  - Shield Icon (guard swap)
```

### Special Keys

```
ESCAPE     - Escape/Cancel
BACKSPACE  - RP Walk Toggle
END        - Mute SWTOR / Timer placeholder
```

---

## 📝 Notes

1. **Dual-Key System**: Guard Swap uses `L` with `NUMPAD_MULTIPLY` pressed simultaneously (6ms offset)
2. **Focus Target Modifier**: `SHIFT+R` is a prefix that redirects the next ability to your focus target
3. **Icon Keys**: These are virtual keys that trigger in-game quickslot icons for visual feedback
4. **Timer Keys**: Currently use `END` as placeholder; actual TTS handled by the timer system
5. **Buffer Tiers**: Not shown here - see gesture-manifest.yaml for timing details

---

_Generated from swtor-vengeance-jugg.json profile_
