const oldFields = ['customer', 'vendor'];
const newFields = ['scheduled', 'estimated', 'requested'];

exports.up = function (knex)
{
    return knex.schema.withSchema('rcg_tms')
        .table('order_stops', (table) =>
        {
            table.text('notes');
            for (const type of oldFields)
            {
                table.dropColumn(`date_scheduled_start_${type}`);
                table.dropColumn(`date_scheduled_end_${type}`);
                table.dropColumn(`${type}_date_type`);
            }

            for (const type of newFields)
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
    return knex.schema.withSchema('rcg_tms')
        .table('order_stops', (table) =>
        {
            table.dropColumn('notes');
            for (const type of newFields)
            {
                table.dropColumn(`date_${type}_start`);
                table.dropColumn(`date_${type}_end`);
                table.dropColumn(`date_${type}_type`);

            }
            for (const type of oldFields)
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
