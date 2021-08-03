const prepareStatement = 'PREPARE enum_type_select (text) AS SELECT n.nspname as enum_schema, t.typname as enum_name, e.enumlabel as value FROM pg_type t JOIN pg_enum e on t.oid = e.enumtypid JOIN pg_catalog.pg_namespace n on n.oid = t.typnamespace WHERE t.typname = $1;';
const cache = {};
let prepared = false;
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
            if (!prepared)
            {
                await knex.raw(prepareStatement);
                prepared = true;
            }
            const res = await knex.raw(`EXECUTE enum_type_select('${enumName}');`);
            const enums = res.rows.map((it) => { return it.value; });
            cache[enumName] = enums;
        }
        return cache[enumName];
    }
}

module.exports = Enums;