const SFRecordType = require('../Models/SFRecordType');

let recordTypes;

class AccountService
{
    static async getId(type)
    {
        // get types
        const recordTypes = await AccountService.getTypes();

        type = type.toLowerCase();
        return recordTypes.find((e) => AccountService.isMatch(e, type));
    }

    static isMatch(obj, type)
    {
        return obj.name === type;
    }

    static async getTypes()
    {
        if (!recordTypes)
            recordTypes = (await SFRecordType.query()).map((e) =>
            {
                return { 'sfid': e.sfid, 'name': e.name.toLowerCase() };
            });

        return recordTypes;
    }
}

module.exports = AccountService;