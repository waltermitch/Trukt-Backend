const cache = {};
let knex = undefined;
class Enums
{
    constructor(_knex)
    {
        // _knex is a knex instance or knex transaction
        knex = _knex;
    }

    async select(enumName)
    {
        if (!knex)
        {
            throw new Error('Enums class requires a knex instance or knex transaction instance');
        }
        enumName = enumName.replace(/'/g, '\'\'');
        if (!(enumName in cache))
        {
            const res = await knex.raw(`SELECT * FROM enum_type_select('${enumName}');`);
            const enums = res.rows.map((it) => { return it.value; });
            cache[enumName] = enums;
        }
        return cache[enumName];
    }
}

module.exports = Enums;