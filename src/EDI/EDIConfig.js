const yamahaConfig = require('./Config/Yamah.json');
const lkqConfig = require('./Config/LKQ.json');

class EDIConfig
{
    static accepts214StatusCode(sfaccount, code)
    {
        const config = EDIConfig.getconfig(sfaccount);
        return config?.[214].statusCodes[code] ?? false;
    }

    static accepts214AppointmentCode(sfaccount, code)
    {
        const config = EDIConfig.getconfig(sfaccount);
        return config?.[214].appointmentCodes[code] ?? false;
    }

    static getconfig(sfaccount)
    {
        switch (sfaccount.sfId)
        {
            case process.env.EDI_CLIENT_YAMAHA:
                return yamahaConfig;
            case process.env.EDI_CLIENT_LKQ:
                return lkqConfig;
            default:
                return undefined;
        }
    }
}

module.exports = EDIConfig;