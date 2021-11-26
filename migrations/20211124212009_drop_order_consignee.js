const TABLE_NAME = 'orders';

exports.up = function (knex)
{
    return knex.schema.table(TABLE_NAME, function (table)
    {
        table.dropForeign('consignee_guid');
        table.dropColumn('consignee_guid');
    });
};

exports.down = function (knex)
{
    return knex.schema.table(TABLE_NAME, function (table)
    {
        table.string('consignee_guid', 100);
        table.foreign('consignee_guid').references('guid__c').inTable('salesforce.account');
    });
};
