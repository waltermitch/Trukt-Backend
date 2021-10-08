const { EventEmitter } = require('events');

/**
 * This is a Promise based mutex.
 * It is a special mutex which acts like a one-time lock.
 * It does not work the same way as a normal lock.
 * DO NOT try to make it work like a normal lock, the use case is very different.
 * Also, you will fail. Do you want to be known as a failure?
 * It is designed to prevent MongoClient from making too many connections
 * when running the Mongo class as a singleton.
 */
class MongoLock
{
    constructor(isLocked = true)
    {
        this._locked = isLocked;
        this._ee = new EventEmitter();
    }

    acquire()
    {
        const self = this;
        return new Promise(resolve =>
        {
            if (!self._locked)
            {
                return resolve();
            }
            const tryAcquire = () =>
            {
                if (!self._locked)
                {
                    self._ee.removeAllListeners('release', tryAcquire);
                    return resolve();
                }
            };
            self._ee.on('release', tryAcquire);
        });
    }

    release()
    {
        const self = this;
        this._locked = false;
        setImmediate(() => self._ee.emit('release'));
    }
}

module.exports = MongoLock;