const SCHEMA_NAME = 'rcg_tms';
const TABLE_NAME = 'order_stops';
const OLDFIELDS = ['customer', 'vendor'];
const NEWFIELDS = ['scheduled', 'estimated', 'requested'];

exports.up = function (knex)
{
    return knex.schema.withSchema(SCHEMA_NAME)
        .table(TABLE_NAME, (table) =>
        {
            table.text('notes');
            for (const type of OLDFIELDS)
            {
                table.dropColumn(`date_scheduled_start_${type}`);
                table.dropColumn(`date_scheduled_end_${type}`);
                table.dropColumn(`${type}_date_type`);
            }

            for (const type of NEWFIELDS)
            {
                table.datetime(`date_${type}_start`);
                table.datetime(`date_${type}_end`);
                table.enu(`date_${type}_type`, null,
                    {
                        useNative: true,
                        enumName: 'date_schedule_types',
                        existingType: true
                    });
            }
        });
};

exports.down = function (knex)
{
    return knex.schema.withSchema(SCHEMA_NAME)
        .table(TABLE_NAME, (table) =>
        {
            table.dropColumn('notes');
            for (const type of NEWFIELDS)
            {
                table.dropColumn(`date_${type}_start`);
                table.dropColumn(`date_${type}_end`);
                table.dropColumn(`date_${type}_type`);
            }
            for (const type of OLDFIELDS)
            {
                table.datetime(`date_scheduled_start_${type}`);
                table.datetime(`date_scheduled_end_${type}`);
                table.enu(`${type}_date_type`, [
                    'estimated',
                    'exactly',
                    'no later than',
                    'no earlier than'
                ], {
                    useNative: true, enumName: 'date_schedule_types', existingType: true
                });
            }
        });
};
