/* eslint-disable */
exports.up = async function (knex)
{
        await knex.raw(`
        update rcg_tms.invoice_bill_lines
        set 
            system_defined  = true,
            system_usage  = 'ari_fuel_surcharge'
        where guid in (
            select 
                ibl.guid  
            from rcg_tms.invoices i 
            inner join rcg_tms.orders o 
            on i.order_guid  = o.guid and o.client_guid in ('36243a00-d9f9-4bd6-8176-96f705e939a3', '670fa143-eb05-4107-a98d-83260f163672', '53788c69-ddfb-4a9f-9e4a-1335e29993e9')
            left join rcg_tms.invoice_bill_relation_types ibrt 
            on i.relation_type_id  = ibrt.id 
            right join rcg_tms.invoice_bill_lines ibl 
            on ibl.invoice_guid = i.invoice_guid 
            where ibrt.name = 'consignee'
            and (ibl.system_defined = false and ibl.item_id = 4)
        );`);
};

exports.down = async function (knex)
{
    // do nothing
};
