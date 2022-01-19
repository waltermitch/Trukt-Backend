const yamahaConfig = require('./Config/Yamah.json');
const lkqConfig = require('./Config/LKQ.json');

class EDIConfig
{
    static accepts214StatusCode(sfAccount, code)
    {
        const config = EDIConfig.getConfig(sfAccount);
        return config?.[214].statusCodes[code] ?? false;
    }

    static accepts214AppointmentCode(sfAccount, code)
    {
        const config = EDIConfig.getConfig(sfAccount);
        return config?.[214].appointmentCodes[code] ?? false;
    }

    static getConfig(sfAccount)
    {
        switch (sfAccount.sfId)
        {
            case process.env.EDI_CLIENT_YAMAHA:
                return yamahaConfig;
            case process.env.EDI_CLIENT_LKQ:
            case process.env.EDI_CLIENT_KOA:
            case process.env.EDI_CLIENT_PGW:
                return lkqConfig;
            default:
                return undefined;
        }
    }
}

module.exports = EDIConfig;