const documentTypes = [
    'vendorInvoice',
    'billOfLading',
    'proofOfDelivery',
    'lumperTicket',
    'scaleTicket',
    'inGateTicket',
    'outGateTicket',
    'miscellaneous',
    'accessorialAgreement',
    'rateConfirmation',
    'loadTender',
    'invoice',
    'customsDocuments',
    'invoiceWithPaperwork',
    'detentionLoading',
    'detentionUnloading',
    'palletReceipt',
    'spotApproval',
    'truckNotUsed',
    'exitPass',
    'balanceDue',
    'packingList',
    'photo'
];

const TABLE_NAME = 'attachments';

exports.up = function (knex)
{
    return knex.schema.withSchema('rcg_tms').createTable(TABLE_NAME, (table) =>
    {
        table.uuid('guid').primary().notNullable().unique();
        table.enu('type', documentTypes, { useNative: true, enumName: 'document_types' }).notNullable();
        table.string('url').notNullable();
        table.string('extension');
        table.string('name').notNullable();
        table.uuid('parent').notNullable();
        table.string('parent_table').notNullable();
    });
};

exports.down = function (knex)
{
    return knex.schema.withSchema('rcg_tms')
        .dropTableIfExists(TABLE_NAME)
        .raw('DROP TYPE IF EXISTS rcg_tms.document_types;');
};
