const table_name = 'index_numbers';

exports.up = function (knex)
{
    // postgres sequences are used only for integer values
    // this will be used for any number of things

    return knex.schema.withSchema('rcg_tms').createTable(table_name, (table) =>
    {
        // size shouldnt be restricted here
        table.string('index').primary().unique();
        table.string('next_index');
        table.comment('Stores index numbers that will be used in other tables to uniquely identify data');
    });
};

exports.down = function (knex)
{
    return knex.schema.withSchema('rcg_tms').dropTableIfExists(table_name);
};
