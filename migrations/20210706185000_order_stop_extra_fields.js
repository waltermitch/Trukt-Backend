
exports.up = function (knex)
{
    return knex.schema.withSchema('rcg_tms')
        .table('order_stops', (table) =>
        {
            table.text('notes');
            for (const type of ['customer', 'vendor'])
            {
                table.dropColumn(`date_scheduled_start_${type}`);
                table.dropColumn(`date_scheduled_end_${type}`);
                table.dropColumn(`${type}_date_type`);
            }

            table.datetime('date_scheduled_start');
            table.datetime('date_scheduled_end');
            table.enu('date_scheduled_type', null,
                {
                    useNative: true,
                    enumName: 'date_schedule_types',
                    existingType: true
                });

        });
};

exports.down = function (knex)
{
    return knex.schema.withSchema('rcg_tms')
        .table('order_stops', (table) =>
        {
            table.dropColumn('notes');
            table.dropColumn('date_scheduled_start');
            table.dropColumn('date_scheduled_end');
            table.dropColumn('date_scheduled_type');
            for (const type of ['customer', 'vendor'])
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
