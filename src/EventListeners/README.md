# Instructions For Adding/Working with Events

1. There should be a file for each `object` or `service` in the `src` folder.
   i.e `OrderService.js` would have an `EventListeners/Order.js` file.

2. Each file listens to the actions related to that objects/services `events`.
   i.e `EventListeners/Order.js` listens to the `order_updated`, `order_deleted` events.

3. There can be multiple listeners (emitters) for each Event.
   i.e `EventListeners/Order.js` listens to the `order_updated` event.
   i.e `EventListeners/EDI.js` listens to the `order_updated` event.

4. When trying to debug an event, `grep` the event name in the `EventListeners` folder
   i.e `grep ./src/EventListeners -rnw -e 'order_updated'`
   i.e. `grep 'order_updated' -rn ./src/EventListeners`

5. Event Emitters can be found in multiple places, this is normal.

6. For an event to be emitted and received, it needs to be linked to the same EventEmitter instance.
   This is done by using the ./index.js which holds an EventEmitter singleton.

## Event Enumeration

The following is a list of all the events that are being emitted.
[Event Enumeration](https://rcglogistics.atlassian.net/wiki/spaces/TRUK/pages/1428520964/Event+System)

# Example of a Listener

```javascript
const { EventEmitter } = require("events");

const listener = new EventEmitter();

listener.on("eventName", () => {
    // setImmedite can be async if the functions are async
    // otherwise it should be sync
    setImmediate(async () => {
        const proms = await Promise.allSettled([
            somethingImportant(),
            somethingElseImportant(),
        ]);

        // Error logging is not suggested, but can be used during debugging
        // we don't want to bog down the app with error logging from events
        // this is a punishable offense and we will come for you if you push this to cloud :)
        for (const p of proms)
            if (p.status === "rejected")
                console.log(p.reason?.response?.data || p.reason);
    });
});
```
