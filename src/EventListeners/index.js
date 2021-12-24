const { EventEmitter } = require('events');

const singleton = new EventEmitter();

module.exports = singleton;