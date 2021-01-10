'use strict';

let request = require('request-promise-native'),
    PROTO = 'https://',
    PORT = 9000;

let sendRequest = (method, url, authKey, data) => {
    let req = {
        url: url,
        json: true,
        rejectUnauthorized: false,
        body: data
    };

    if (authKey) {
        req.headers = {
            AUTH: authKey
        };
    }

    return request[method](req);
}

let keyData = (codeset, code, action) => {
    if (!action) {
        action = 'KEYPRESS';
    }
    return {
        KEYLIST: [{
            CODESET: codeset,
            CODE: code,
            ACTION: action
        }]
    };
}

let findInputByName = (name, list) => {

    // first search by internal name
    for (let i = 0; i < list.ITEMS.length; i++) {
        if (list.ITEMS[i].NAME.toLowerCase() === name.toLowerCase()) {
            return list.ITEMS[i].NAME;
        }
    };

    // second search by user name
    for (let i = 0; i < list.ITEMS.length; i++) {
        if (list.ITEMS[i].VALUE.NAME.toLowerCase() === name.toLowerCase()) {
            return list.ITEMS[i].NAME;
        }
    };

    return null;
};

/**
 * @param {string} host Host IP address (and optionally PORT) of the smartcast device
 * @param {string=} authKey auth key to authorize yourself with the smart cast device
 */
let SMARTCAST = function smartcast(host, authKey) {
    let _pairingRequestToken = '',
        _authKey = authKey || '',
        _deviceId = '',
        _deviceName = '';

    // if user didn't provide a port, use the default port
    if (host.indexOf(':') == -1) {
        host += ':' + PORT;
    }
    host = PROTO + host;

    this.power = {
        /**
         * Get the current power mode from the smartcast device
         * @return {promise}
         */
        currentMode: () => {
            let url = host + '/state/device/power_mode';
            return sendRequest('get', url);
        }
    };

    this.pairing = {
        /**
         * Initiate the pairing process with the smartcast device
         * @param {string=} deviceName name of the calling device
         * @param {string=} deviceId unique identifier of the calling device
         * @return {Observable}
         */
        initiate: (deviceName, deviceId) => {
            _deviceName = deviceName || 'node-app-' + new Date().getTime();
            _deviceId = deviceId || 'node-app-' + new Date().getTime();

            let data = {
                DEVICE_NAME: _deviceName,
                DEVICE_ID: _deviceId
            };
            return sendRequest('put', host + '/pairing/start', null, data).then((data) => {
                if (data && data.STATUS && data.STATUS.RESULT === 'SUCCESS') {
                    _pairingRequestToken = data.ITEM.PAIRING_REQ_TOKEN;
                    return data;
                } else {
                    if (data.STATUS.RESULT === 'BLOCKED') {
                        return Promise.reject('Failed to initiate the pairing process because a pairing request has already been initiated. Please wait for the pin to clear from the screen before initiating the pairing process again.', data);
                    } else {
                        return Promise.reject(data);
                    }
                }
            });
        },

        /**
         * Pair with the smartcast device using the specified PIN
         * @param {string} pin The PIN displayed on the smartcast device
         * @return {Observable}
         */
        pair: (pin) => {
            let data = {
                DEVICE_ID: _deviceId,
                CHALLENGE_TYPE: 1,
                RESPONSE_VALUE: pin,
                PAIRING_REQ_TOKEN: _pairingRequestToken
            };
            return sendRequest('put', host + '/pairing/pair', null, data).then((data) => {
                if (data && data.STATUS.RESULT === 'SUCCESS') {
                    _authKey = data.ITEM.AUTH_TOKEN;
                    return data;
                } else {
                    return Promise.reject(data);
                }
            });
        },

        useAuthToken: (key) => {
            _authKey = key;
        },

        /**
         * Cancel a pairing request with a given smartcast device
         * @param {string} ip IP address of the smartcast device
         * @return {promise}
         */
        cancel: (ip) => {
            throw new Error('not implemented');
        }
    };

    this.input = {
        list: () => {
            return sendRequest('get', host + '/menu_native/dynamic/audio_settings/input', _authKey);
        },
        current: () => {
            return sendRequest('get', host + '/menu_native/dynamic/audio_settings/input/current_input', _authKey);
        },
        set: (name) => {
            return new Promise((resolve, reject) => {
                Promise.all([this.input.list(), this.input.current()]).then(values => {
                    let inputList = values[0],
                        currentInput = values[1],
                        inputName = findInputByName(name, inputList);

                        if (inputList.STATUS.RESULT !== 'SUCCESS' || currentInput.STATUS.RESULT !== 'SUCCESS') {
                            reject({ list: inputList, current: currentInput });
                            return;
                        }

                        if (!inputName) {
                            reject('Input: ' + name + ' not found', inputList);
                            return;
                        }

                        let data = {
                            REQUEST: "MODIFY",
                            VALUE: inputName,
                            HASHVAL: currentInput.ITEMS[0].HASHVAL
                        };

                        sendRequest('put', host + '/menu_native/dynamic/audio_settings/input/current_input', _authKey, data).then(resolve).catch(reject)
                }).catch(reject);
            });
        }
    };

    this.control = {
        keyCommand: (codeset, code, action) => {
            let data = keyData(codeset, code, action);
            return sendRequest('put', host + '/key_command/', _authKey, data);
        },
        volume: {
            down: () => {
                return this.control.keyCommand(5, 0);
            },
            up: () => {
                return this.control.keyCommand(5, 1);
            },
            get: () => {
                return new Promise((resolve) => {
                    sendRequest('get', host + '/menu_native/dynamic/audio_settings/audio/volume', _authKey).then(resolve)
                });
            },
            set: (value) => {
                return new Promise((resolve, reject) => {
                    if (typeof value !== 'number') {
                        reject('value must be a number');
                    }
                    if (value < 0 || value > 100) {
                        reject('value is out of range, please enter a number between 0 to 100 inclusive');
                    }
                    this.settings.audio.get().then((settings) => {
                        let volume = settings.ITEMS.find(i => i.CNAME === 'volume')
                        if (!volume) {
                            reject('no volume setting found');
                            return;
                        }

                        let data = {
                            REQUEST: 'MODIFY',
                            HASHVAL: volume.HASHVAL,
                            VALUE: Math.round(value)
                        };
                        sendRequest('put', host + '/menu_native/dynamic/tv_settings/audio/volume', _authKey, data).then(resolve).catch(reject)
                    }).catch(reject);
                });
            },
            getMuteState: () => {
                return new Promise((resolve) => {
                    sendRequest('get', host + '/menu_native/dynamic/tv_settings/audio/mute', _authKey).then(resolve)
                });
            },
            unmute: () => {
                return this.control.keyCommand(5, 2);
            },
            mute: () => {
                return this.control.keyCommand(5, 3);
            },
            toggleMute: () => {
                return this.control.keyCommand(5, 4);
            }
        },
        input: {
            cycle: () => {
                return this.control.keyCommand(7, 1);
            }
        },
        power: {
            off: () => {
                return this.control.keyCommand(11, 0);
            },
            on: () => {
                return this.control.keyCommand(11, 1);
            },
            toggle: () => {
                return this.control.keyCommand(11, 2);
            }
        },
        media: {
            seek: {
                forward: () => {
                    return this.control.keyCommand(2, 0);
                },
                back: () => {
                    return this.control.keyCommand(2, 1);
                }
            },
            play: () => {
                return this.control.keyCommand(2, 3);
            },
            pause: () => {
                return this.control.keyCommand(2, 2);
            },
            cc: () => {
                return this.control.keyCommand(4, 4);
            }
        },
        menu: () => {
            return this.control.keyCommand(4, 8);
        },
        info: () => {
            return this.control.keyCommand(4, 6);
        },
        smartcast: () => {
            return this.control.keyCommand(4, 3);
        }
    };
};

module.exports = SMARTCAST;
