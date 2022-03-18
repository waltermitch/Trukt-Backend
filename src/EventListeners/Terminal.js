const TerminalService = require('../Services/TerminalService');
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

listener.on('terminal_created', ({ terminalGuid }) =>
{
    setImmediate(async () =>
    {
        // we need to delay by 5 seconds to make sure the order is done being created
        await new Promise(resolve => setTimeout(resolve, 9000));

        const proms = await Promise.allSettled([
            // need to recalc distance for all orders that use this terminal
            TerminalService.resolveTerminals([{ guid: terminalGuid }])
        ]);

        logEventErrors(proms, 'terminal_created');
    });
});