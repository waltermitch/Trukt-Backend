const Terminal = require('../Services/TerminalService');
const ArcgisClient = require('../ArcgisClient');

const { SYSTEM_USER } = process.env;

class TerminalsHanlder
{
    static async verifyPendingTerminals()
    {
        if (!ArcgisClient.isSetuped() && !SYSTEM_USER)
            return;

        const unverifiedTerminals = await Terminal.getUnverifiedTerminals();
        const terminalsToUpdate = [];

        for (const terminal of unverifiedTerminals)
            terminalsToUpdate.push(Terminal.resolveTerminal(terminal));

        return await Promise.allSettled(terminalsToUpdate);
    }
}

module.exports = TerminalsHanlder;