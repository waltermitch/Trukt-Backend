const table_name = 'requests';

exports.up = function (knex)
{
    return knex.schema.withSchema('rcg_tms').createTable(table_name, (table) =>
    {
        table.uuid('guid').primary().notNullable().unique(); // posgress create UUID
        table.string('status', 16).notNullable(); // to store status string
        table.float('price', 8, 2).notNullable(); // required to store price
        table.string('createdBy', 32).notNullable(); // required loadboard name
        table.string('externalGUID', 32); // shipcars SD guid
        table.string('jobID', 8) // job ID not required but tied to Job table?
        table.string('pickupDate', 32); // "2021-06-04T05:22:38.654Z", //research how it comes from SD
        table.string('pickupDateEnd', 32);
        table.string('offerSentDate', 32);
        table.string('CarrierDOT', 32);
    });
};

exports.down = function (knex)
{
    return knex.schema.withSchema('rcg_tms').dropTableIfExists(table_name);
};

// SD GUID: "4f797316-63a8-432a-a4ef-2986b8occ89d"
// SD PickUP: "2019-11-20T10:33:29.112+0000" 28 char
// offerGUID: ef2818b8-a55e-436a-a61e-993ae0470928 Req
// "carrier_guid": "512cb41f-45f3-4996-83a5-83687bf0cc0b"
// "carrier_usdot": 12345,

// TruckGUID; "df7dbc1a-a21d-e911-a9ec-a3b8a698ca96"
// TruckCreatedBy: 	"df7dbc1a-a21d-e911-a9ec-a3b8a698ca96" The identifier of the person that created the load
// "pickup_date": "2019-04-04",
// "delivery_date": "2019-04-04",
// "price": "string"
// carrier: URL