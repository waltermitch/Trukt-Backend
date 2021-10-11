const tableName = 'vehicles';

exports.up = function (knex)
{
    // alter table to add is_paid column
    return knex.raw(`
        ALTER TABLE rcg_tms.${tableName}
            ADD name VARCHAR(255)
	        GENERATED ALWAYS AS (rcg_tms.${tableName}.year || ' '||  rcg_tms.${tableName}.make || ' ' || rcg_tms.${tableName}.model) STORED;`);
};

exports.down = function (knex)
{
    // alter table to remove is_paid column
    return knex.schema.withSchema('rcg_tms')
        .alterTable(tableName, (table) =>
        {
            table.dropColumn('name');
        });
};
