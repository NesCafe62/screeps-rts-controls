RTS Controls client abuse module for screeps game.

# Installation

## Browser
Open `rts-controls.user.js` file in the repo, click "Raw" button and install script with Tampermonkey browser plugin

## Screeps client
(will update soon)

# Usage
implement function `RTS.command(type, creepsId, target = undefined)` in your screeps bot, for example:
```js
class RTSControls {

	/**
	 * @param {string} type
	 * @param {string[]} creepsId
	 * @param {object} target
	 */
	command(type, creepsId, target = undefined) {
		const creeps = creepsId.map(id => Game.getObjectById(id)).filter(creep => !!creep);
		if (creeps.length === 0) {
			return `RTS Controls command: '${type}', no creeps selected`;
		}
		// ... set order to creeps memory
		return `RTS Controls command: '${type}', creeps: [` + creeps.map(c => c.name).join(', ') + `], target: ${JSON.stringify(target)}`;
	}

}
global.RTS = new RTSControls();
```

Currently supported commands:
- RMB: `"smartOrder"`
- Hold key `A` + RMB: `"smartAttack"`
- Hold key `M` + RMB: `"smartMove"`
- Hold key `R` + RMB: `"repair"`
- Hold key `T` + RMB: `"transfer"`
- Hold key `P` + RMB: `"patrol"`
- Hold key `G` + RMB: `"guard"`
- Key `S`: `"stop"`
- Key `D`: `"drop"`

## Config
Keystrokes are customizable from `Memory`.

Set your custom config with keystrokes, orders and marker colors to `Memory.RTS_config`.

Use format: `<keyStroke>: <orderType>` or `<keyStroke>: [<orderType>, <color>]`

Keystroke support one keyboard letter with oprional `RMB`, `Shift` and `Ctrl` (separated by `+`), but keep in mind `Shift` will be reserved for queueing orders.

```js
Memory.RTS_config = {
    'RMB': ['smartOrder', '#00ac00'],
    'RMB+A': ['smartAttack', 'red'],
    'RMB+M': ['smartMove', '#3333ff'],
    'RMB+T': ['transfer', '#ff8f00'],
    'RMB+R': ['repair', '#ff8f00'],
    'RMB+P': ['patrol', '#3333ff'],
    'RMB+G': ['guard', '#ff8f00'],
    'C': 'finishControl',
    'S': 'stop',
    'D': 'drop',
};
```
