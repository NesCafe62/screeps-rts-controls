/*jshint multistr: true */

// ==UserScript==
// @name         Screeps RTS controls
// @namespace    https://screeps.com/
// @version      0.0.3
// @author       U-238
// @include      https://screeps.com/a/
// @run-at       document-ready
// @downloadUrl  https://raw.githubusercontent.com/NesCafe62/screeps-rts-controls/refs/heads/main/rts-controls.js
// @require      http://ajax.googleapis.com/ajax/libs/jquery/1.8.3/jquery.min.js
// @require      https://github.com/Esryok/screeps-browser-ext/raw/master/screeps-browser-core.js
// ==/UserScript==

function waitForElement(selector, fn, interval = 100) {
    let timeout = setInterval(() => {
        let el = document.querySelector(selector);
        if (!el) {
            return;
        }
        clearInterval(timeout);
        fn(el);
    }, interval);
    return timeout;
}

function compileElement(content, parent, scope) {
    parent = parent || angular.element(document.body);
    let $scope = scope || parent.scope();
    let $compile = parent.injector().get('$compile');
    return $compile(content)($scope);
}

function getMyUserId() {
    if (!myUserId) {
        myUserId = ScreepsAdapter.User._id;
    }
    return myUserId;
}

function init() {
    getMyUserId();
    // document.body.rtsLogs.push('init');

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    DomHelper.addStyle("\
        .rts-selection-box { position: absolute; pointer-events: none; border-radius: 5px; background-color: rgba(0, 88, 255, 0.1); outline: rgba(0, 159, 255, 0.45) solid 2px; } \
        .rts-selection-marker { \
            position: absolute; pointer-events: none; border-radius: 50%; outline: #3fb7ff solid 2px; width: 2.4%; height: 2.4%; margin-left: -0.2%; margin-top: -0.2%; \
            transition-timing-function: cubic-bezier(0.455, 0.03, 0.515, 0.955); \
            transition-property: left, top; \
        } \
        .rts-target-marker { position: absolute; pointer-events: none; border-radius: 50%; outline: var(--color) solid 2px; width: 16px; height: 16px; animation-name: rts-marker; animation-duration: 0.5s; animation-iteration-count: 1; } \
        @keyframes rts-marker { \
	        0% { transform: scale(0, 0); } \
	        50% { transform: scale(1, 1); } \
	        100% { transform: scale(0, 0); } \
        } \
    ");

    selectionBoxEl = $('<div class="rts-selection-box" style="display: mone;"></div>')[0];
    targetMarkerEl = $('<div class="rts-target-marker" style="display: mone;"></div>')[0];
}

function inSelection(obj, fromX, fromY, toX, toY) {
    let {x, y} = obj;
    return (
        x >= fromX && y >= fromY &&
        x <= toX && y <= toY
    );
}

function sendConsoleCommand(command, $scope) {
    if ($scope.Room.roomMode === 'world') {
        ScreepsAdapter.Api.post('user/console', {
            expression: command,
            shard: $scope.Room.shardName,
            hidden: true
        });
    } else {
        ScreepsAdapter.Connection.sendConsoleCommand(command, getMyUserId());
    }
}

function setCursorVisible(visible) {
    let el = document.querySelector('.cursor');
    if (el) {
        el.style.display = visible ? '' : 'none';
    }
}

function createTarget(pos, roomObjects) {
    let count = 0;
    let target = {type: 'pos', pos};
    for (let obj of roomObjects) {
        if (obj.x === pos.x && obj.y === pos.y) {
            count++;
            let type = obj.type;
            if (type === 'creep') {
                type = (obj.user === myUserId) ? 'myCreep' : 'hostileCreep';
            }
            if (type === 'structure') {
                type = 'structures';
            }
            if (count > 1 || type === 'structures') {
                target.type = 'objects';
                target.id = undefined;
                target.name = undefined;
            } else {
                target.type = type;
                if (obj._id) {
                    target.id = obj._id;
                } else {
                    target.name = obj.name;
                }
            }
            if (type === 'structures') {
                if (!target.structures) {
                    target.structures = [];
                }
                target.structures.push(obj._id);
            } else {
                target[type] = obj._id || obj.name;
            }
        }
    }
    if (count === 1) {
        target[target.type] = undefined;
    }
    return target;
}

function clamp(value, min, max) {
    if (value < min) {
        return min;
    }
    if (value > max) {
        return max;
    }
    return value;
}

// handle cursor coords outside of room bounds instead of $scope.Room.cursorPos
function getCursorPos(event) {
    let cursorLayerEl = $('.cursor-layer');
    let offset = cursorLayerEl.offset();
    let x = Math.floor((event.pageX - offset.left) / cursorLayerEl.width() * 50);
    let y = Math.floor((event.pageY - offset.top) / cursorLayerEl.height() * 50);
    return { x: clamp(x, 0, 49), y: clamp(y, 0, 49) };
}

let holdKeys = {
    a: false,
    m: false,
};
function handleKeyDown(event) {
    if (!$scope || $scope.Room.selectedAction.action !== 'rts-controls') {
        return;
    }
    if (['a', 'm'].includes(event.key)) {
        holdKeys[event.key] = true;
    }
}

function handleKeyUp(event) {
    if (!$scope || $scope.Room.selectedAction.action !== 'rts-controls') {
        return;
    }
    if (['a', 'm'].includes(event.key)) {
        holdKeys[event.key] = false;
    }
}

function handleMouseDown(event) {
    if (
        $scope.Room.selectedAction.action !== 'rts-controls' ||
        !event.target.classList.contains('cursor-layer') ||
        event.button !== MOUSE_BUTTON_LEFT
    ) {
        return;
    }
    let cursorPos = $scope.Room.cursorPos;
    if (!cursorPos) {
        return;
    }
    event.stopPropagation();
    selecting = true;
    setCursorVisible(false);
    selectionBoxEl.style.display = 'block';
    selectionBoxEl.style.left = (cursorPos.x * 2) + '%';
    selectionBoxEl.style.top = (cursorPos.y * 2) + '%';
    selectionBoxEl.style.width = '2%';
    selectionBoxEl.style.height = '2%';
    startX = cursorPos.x;
    startY = cursorPos.y;
    $('.cursor-layer').append(selectionBoxEl);
}

function handleMouseMove(event) {
    if (!selecting) {
        return;
    }
    setCursorVisible(false);
    let cursorPos = getCursorPos(event);
    selectionBoxEl.style.left = (Math.min(cursorPos.x, startX) * 2) + '%';
    selectionBoxEl.style.top = (Math.min(cursorPos.y, startY) * 2) + '%';
    selectionBoxEl.style.width = ((Math.abs(cursorPos.x - startX) + 1) * 2) + '%';
    selectionBoxEl.style.height = ((Math.abs(cursorPos.y - startY) + 1) * 2) + '%';
}

function handleMouseUp(event) {
    if (!selecting) {
        return;
    }
    selecting = false;
    setCursorVisible(true);
    selectionBoxEl.style.display = 'none';
    selectedIds = [];
    let cursorPos = getCursorPos(event);
    let fromX = Math.min(cursorPos.x, startX);
    let fromY = Math.min(cursorPos.y, startY);
    let toX = (fromX + Math.abs(cursorPos.x - startX));
    let toY = (fromY + Math.abs(cursorPos.y - startY));
    for (let obj of $scope.Room.objects) {
        if (
            obj.type === 'creep' &&
            inSelection(obj, fromX, fromY, toX, toY) &&
            obj.user === myUserId
        ) {
            selectedIds.push(obj._id);
        }
    }

    updateSelectedMarkers();
    // console.log('selectedObjects', selectedIds);
}

function createSelectionMarker() {
    return $("<div class='rts-selection-marker'></div>")[0];
}

let markers = new Map();
function updateSelectedMarkers() {
    let time = new Date().getTime();
    if ($scope.Room.selectedAction.action === 'rts-controls') {
        let cursorLayerEl = $('.cursor-layer');
        for (let object of $scope.Room.objects) {
            let id = object._id;
            if (selectedIds.includes(id)) {
                let markerEl = markers.get(id);
                if (!markerEl) {
                    markerEl = createSelectionMarker();
                    markers.set(id, markerEl);
                    cursorLayerEl.append(markerEl);
                } else if (markerEl.parentNode !== cursorLayerEl[0]) {
                    cursorLayerEl.append(markerEl);
                }
                markerEl._time = time;
                if (tickDuration) {
                    markerEl.style['transition-duration'] = (tickDuration / 1000) + 's';
                }
                markerEl.style.left = (object.x * 2) + '%';
                markerEl.style.top = (object.y * 2) + '%';
            }
        }
    }
    for (let markerEl of document.querySelectorAll('.rts-selection-marker')) {
        if (markerEl._time !== time) {
            markerEl.remove();
        }
    }
    for (let [id, markerEl] of markers.entries()) {
        if (markerEl._time !== time) {
            markers.delete(id);
        }
    }
}

function deleteMarkers() {
    /* for (let markerEl of markers.values()) {
        markerEl.remove();
    } */
    $('.rts-selection-marker').remove();
    markers.clear();
}

let markerInterval;
function handleContextMenu(event) {
    if (selecting || $scope.Room.selectedAction.action !== 'rts-controls') {
        return;
    }
    let cursorPos = $scope.Room.cursorPos;
    if (!cursorPos) {
        return;
    }
    event.preventDefault();

    let markerColor = '#00ac00';
    let orderType = 'smartOrder';
    if (holdKeys.a) {
        orderType = 'attack';
        markerColor = 'red';
    } else if (holdKeys.m) {
        orderType = 'move';
        markerColor = '#ff8f00';
    }

    targetMarkerEl.style.left = (cursorPos.x * 2) + '%';
    targetMarkerEl.style.top = (cursorPos.y * 2) + '%';
    targetMarkerEl.style.setProperty('--color', markerColor);
    targetMarkerEl.remove();
    targetMarkerEl.offsetHeight; // reflow
    $('.cursor-layer').append(targetMarkerEl);
    if (markerInterval) {
        clearInterval(markerInterval);
    }
    markerInterval = setInterval(() => {
        targetMarkerEl.remove();
    }, 500);

    if (selectedIds.length === 0) {
        return;
    }
    let target = createTarget({
        x: cursorPos.x,
        y: cursorPos.y,
        roomName: $scope.Room.roomName
    }, $scope.Room.objects);
    sendConsoleCommand('RTS.command("' + orderType +'",' + JSON.stringify(selectedIds) + ',' + JSON.stringify(target) + ')', $scope);
}

const MOUSE_BUTTON_LEFT = 0;
const MOUSE_BUTTON_MIDDLE = 1;
// const MOUSE_BUTTON_RIGHT = 2;

let selectionBoxEl, targetMarkerEl;
let rtsControlsButtonEl;
let $scope;
let selecting = false;
let myUserId;
let selectedIds = [];
let startX, startY;

function updateButton() {
    let content = "\
        <md:button \
            class='md-fab md-button rts-controls' \
            ng-transclude ng:class=\"{'md-primary': Room.selectedAction.action == 'rts-controls'}\" \
            ng:click=\"Room.selectedAction = {action: 'rts-controls'}\" \
            tooltip-append-to-body='true' tooltip-placement='bottom' uib-tooltip='RTS Controls'>\
                <i style='font-size: 2.2rem; transform: scale(-1,1);' class='fa fa-location-arrow ng-scope'></i>\
        </md:button>";

    if (rtsControlsButtonEl) {
        rtsControlsButtonEl.remove();
    }
    let roomEl = document.querySelector('.room');
    rtsControlsButtonEl = compileElement(content, angular.element(roomEl))[0];
    rtsControlsButtonEl.firstElementChild.remove(); // fix icon duplicate (no idea why it happens)
    $('.room-controls-content').append(rtsControlsButtonEl);
}

let tickDuration = 0;
let prevTime = 0;
let prevTick = 0;
function update() {
    updateButton();

    let roomEl = document.querySelector('.room');
    $scope = angular.element(roomEl).scope();

    deleteMarkers();
    if (selectedIds.length > 0) {
        waitForElement('.cursor-layer', updateSelectedMarkers);
    }

    // document.body.rtsLogs.push('update');
    if (!roomEl._addedRoomEvents) {
        ScreepsAdapter.Connection.onRoomUpdate($scope, () => {
            let time = new Date().getTime();
            let tick = $scope.Room.gameTime;
            if (prevTime && tick === prevTick + 1) {
                tickDuration = time - prevTime;
                // console.log('duration:', tickDuration);
            }
            prevTick = tick;
            prevTime = time;
            needDeleteMarkers = 0;
            updateSelectedMarkers();
        });

        roomEl.addEventListener('mousedown', handleMouseDown, true);
        roomEl.addEventListener('contextmenu', handleContextMenu);
        roomEl.addEventListener('mousemove', handleMouseMove);
        roomEl.addEventListener('mouseup', handleMouseUp);
        roomEl._addedRoomEvents = true;
    }
}

// document.body.rtsLogs = [];

// Entry point
$(document).ready(() => {
    init();
    let timeout;
    // document.body.rtsLogs.push('domReady');
    ScreepsAdapter.onRoomChange( roomName => {
        if (timeout) {
            clearInterval(timeout);
        }
        // document.body.rtsLogs.push('onRoomChange');
        timeout = waitForElement('.room-controls-content', update);
    });
});
