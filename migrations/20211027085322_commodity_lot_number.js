const OLD_TABLE_NAME = 'order_stop_links';
const TABLE_NAME = 'commodities';

exports.up = function (knex)
{
    return knex.schema
        .table(TABLE_NAME, function (table)
        {
            table.string('lot_number').nullable();
        })
        .raw(`UPDATE  rcg_tms.${TABLE_NAME}
                SET lot_number = links.lot_number
                FROM rcg_tms.${OLD_TABLE_NAME} links
                WHERE links.commodity_guid = rcg_tms.commodities.guid `)
        .table(OLD_TABLE_NAME, function (table)
        {
            table.dropColumn('lot_number');
        });
};

exports.down = function (knex)
{
    return knex.schema
        .table(OLD_TABLE_NAME, function (table)
        {
            table.string('lot_number').nullable();
        })
        .raw(`UPDATE rcg_tms.${OLD_TABLE_NAME}
                SET lot_number = comms.lot_number
                FROM rcg_tms.${TABLE_NAME} comms
                WHERE comms.guid = rcg_tms.${OLD_TABLE_NAME}.commodity_guid `)
        .table(TABLE_NAME, function (table)
        {
            table.dropColumn('lot_number');
        });
};
