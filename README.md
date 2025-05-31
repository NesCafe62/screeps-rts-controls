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
- Key `S`: `"stop"`
- Key `D`: `"drop"`
