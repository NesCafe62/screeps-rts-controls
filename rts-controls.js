/*jshint multistr: true */

// ==UserScript==
// @name         Screeps RTS controls
// @namespace    https://screeps.com/
// @version      0.0.2
// @author       U-238
// @include      https://screeps.com/a/
// @run-at       document-ready
// @downloadUrl  https://raw.githubusercontent.com/NesCafe62/screeps-rts-controls/refs/heads/main/rts-controls.js
// @require      http://ajax.googleapis.com/ajax/libs/jquery/1.8.3/jquery.min.js
// @require      https://github.com/Esryok/screeps-browser-ext/raw/master/screeps-browser-core.js
// ==/UserScript==

function waitForElement(selector, fn, interval = 100) {
    let timeout = setInterval( function() {
        let el = document.querySelector(selector);
        if (!el) {
            return;
        }
        clearInterval(timeout);
        fn(el);
    }, interval);
    return timeout;
}

function compileElement(content, parent) {
    parent = parent || angular.element(document.body);
    let $scope = parent.scope();
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

    let content = "\
        <md:button\
            class='md-fab md-button rts-controls' \
            ng-transclude ng:class=\"{'md-primary': Room.selectedAction.action == 'rts-controls'}\" \
            ng:click=\"Room.selectedAction = {action: 'rts-controls'}\" \
            tooltip-append-to-body='true' tooltip-placement='bottom' uib-tooltip='RTS Controls'>\
                <i style='font-size: 2.2rem; transform: scale(-1,1);' class='fa fa-location-arrow ng-scope'></i>\
        </md:button>";

    let buttonEl = compileElement(content, angular.element($('.room')))[0];
    buttonEl.firstElementChild.remove(); // fix icon duplicate (no idea why it happens)
    $('.room-controls-content').append(buttonEl);

    DomHelper.addStyle("\
        .rts-selection-box { position: absolute; pointer-events: none; border-radius: 5px; background-color: RGBA(0, 88, 255, 0.1); outline: rgba(0, 159, 255, 0.45) solid 2px; }\
    ");

    selectionBoxEl = $('<div class="rts-selection-box" style="display: mone;"></div>')[0];
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

const MOUSE_BUTTON_LEFT = 0;
const MOUSE_BUTTON_MIDDLE = 1;
// const MOUSE_BUTTON_RIGHT = 2;

let currentRoomName;
let selectionBoxEl;
let initialized = false;
let selecting = false;
let myUserId;
let selectedIds = [];
let startX, startY;
function update() {
    if (!initialized) {
        init();
        initialized = true;
    }

    let $scope = angular.element($('.room')).scope();
    currentRoomName = $scope.Room.roomName;

    let cursorLayerEl = $('.cursor-layer')[0];
    cursorLayerEl.addEventListener('mousedown', function(event) {
        if ($scope.Room.selectedAction.action !== 'rts-controls' || event.button !== MOUSE_BUTTON_LEFT) {
            return;
        }
        event.stopPropagation();
        selecting = true;
        $('.cursor')[0].style.display = 'none';
        selectionBoxEl.style.display = 'block';
        selectionBoxEl.style.left = ($scope.Room.cursorPos.x * 2) + '%';
        selectionBoxEl.style.top = ($scope.Room.cursorPos.y * 2) + '%';
        selectionBoxEl.style.width = '2%';
        selectionBoxEl.style.height = '2%';
        startX = $scope.Room.cursorPos.x;
        startY = $scope.Room.cursorPos.y;
        $('.cursor-layer').append(selectionBoxEl);
    });
    cursorLayerEl.addEventListener('contextmenu', function(event) {
        if ($scope.Room.selectedAction.action !== 'rts-controls') {
            return;
        }
        event.preventDefault();
        if (selectedIds.length === 0) {
            return;
        }
        let x = $scope.Room.cursorPos.x;
        let y = $scope.Room.cursorPos.y;
        let count = 0;
        let target = {type: 'pos', pos: {x, y, roomName: currentRoomName}};
        for (let obj of $scope.Room.objects) {
            if (obj.x === x && obj.y === y) {
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
        sendConsoleCommand('RTS.command("smartOrder",' + JSON.stringify(selectedIds) + ',' + JSON.stringify(target) + ')', $scope);
    });
    let roomEl = $('.room')[0];
    if (!roomEl._addedRoomEvents) {
        roomEl.addEventListener('mousemove', function(event) {
            if (!selecting) {
                return;
            }
            if (!$scope.Room.cursorPos) {
                // todo: temporary
                return;
            }
            selectionBoxEl.style.left = (Math.min($scope.Room.cursorPos.x, startX) * 2) + '%';
            selectionBoxEl.style.top = (Math.min($scope.Room.cursorPos.y, startY) * 2) + '%';
            selectionBoxEl.style.width = ((Math.abs($scope.Room.cursorPos.x - startX) + 1) * 2) + '%';
            selectionBoxEl.style.height = ((Math.abs($scope.Room.cursorPos.y - startY) + 1) * 2) + '%';
        });
        roomEl.addEventListener('mouseup', function(event) {
            if (!selecting) {
                return;
            }
            selecting = false;
            $('.cursor')[0].style.display = '';
            selectionBoxEl.style.display = 'none';
            selectedIds = [];
            let fromX = Math.min($scope.Room.cursorPos.x, startX);
            let fromY = Math.min($scope.Room.cursorPos.y, startY);
            let toX = (fromX + Math.abs($scope.Room.cursorPos.x - startX));
            let toY = (fromY + Math.abs($scope.Room.cursorPos.y - startY));
            for (let obj of $scope.Room.objects) {
                if (
                    obj.type === 'creep' &&
                    inSelection(obj, fromX, fromY, toX, toY) &&
                    obj.user === myUserId
                ) {
                    selectedIds.push(obj._id);
                }
            }
            // console.log('selectedObjects', selectedIds);
            // sendConsoleCommand(``, $scope);
        });
        roomEl._addedRoomEvents = true;
    }
}

// Entry point
$(document).ready(() => {
    let timeout;
    ScreepsAdapter.onRoomChange( function(roomName) {
        if (timeout) {
            clearInterval(timeout);
        }
        timeout = waitForElement('.room-controls-content', update);
    });
});
