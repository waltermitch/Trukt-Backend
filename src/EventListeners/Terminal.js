const OrderService = require('../Services/OrderService');
const logEventErrors = require('./logEventErrors');
const listener = require('./index');

listener.on('terminal_resolved', ({ terminalGuid }) =>
{
    setImmediate(async () =>
    {
        const proms = await Promise.allSettled([
            // need to recalc distance for all orders that use this terminal
            OrderService.recalcDistancesAfterTerminalResolution(terminalGuid)
        ]);

        logEventErrors(proms, 'terminal_resolved');
    });
});