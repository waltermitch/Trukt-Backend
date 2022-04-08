const SCHEMA_NAME = 'rcg_tms';
const INVOICE_TABLE = 'invoices';
const BILL_TABLE = 'bills';

exports.up = function (knex)
{
    return knex.schema.withSchema(SCHEMA_NAME)
        .raw(`ALTER TABLE rcg_tms.invoices 
            ADD COLUMN relation_type_id integer,
            ADD CONSTRAINT "invoices_relation_type_id_foreign" FOREIGN KEY (relation_type_id) REFERENCES rcg_tms.invoice_bill_relation_types (id) ON DELETE RESTRICT;

            ALTER TABLE rcg_tms.bills
            ADD COLUMN relation_type_id integer,
            ADD CONSTRAINT "bills_relation_type_id_foreign" FOREIGN KEY (relation_type_id) REFERENCES rcg_tms.invoice_bill_relation_types (id) ON DELETE RESTRICT;

            -- update refferer
            WITH refferer_inovices (invoice_guid ,order_guid) AS (
            	SELECT i.invoice_guid , i.order_guid FROM rcg_tms.invoices i 
            	LEFT JOIN rcg_tms.invoice_bills ib ON ib.guid = i.invoice_guid 
            	LEFT JOIN rcg_tms.orders o ON i.order_guid = o.guid 
            	WHERE o.referrer_guid = ib.consignee_guid AND o.referrer_guid IS NOT NULL
            )
            UPDATE rcg_tms.invoices ii
            SET relation_type_id = 3
            FROM refferer_inovices rr
            WHERE ii.invoice_guid = rr.invoice_guid AND ii.order_guid = rr.order_guid; 
            
            -- update not client and not refferrer
            WITH consignee_inovices (invoice_guid, order_guid) AS (
            	SELECT i.invoice_guid , i.order_guid FROM rcg_tms.invoices i 
            	LEFT JOIN rcg_tms.invoice_bills ib ON ib.guid = i.invoice_guid 
            	LEFT JOIN rcg_tms.orders o ON i.order_guid = o.guid 
            	WHERE 
            	o.referrer_guid != ib.consignee_guid 
            	AND o.client_guid != ib.consignee_guid 
            	AND ib.consignee_guid IS NOT NULL  
            )
            UPDATE rcg_tms.invoices ii
            SET relation_type_id = 2
            FROM consignee_inovices con
            WHERE ii.invoice_guid = con.invoice_guid AND ii.order_guid = con.order_guid AND ii.relation_type_id IS NULL; 
            
            -- left over invoices become the consignee
            UPDATE rcg_tms.invoices i 
            SET relation_type_id = 2
            WHERE i.relation_type_id IS NULL;
            
            -- vendor TYPES 
            WITH service_types (job_guid) AS (
              SELECT guid FROM rcg_tms.order_jobs oj2 
              LEFT JOIN rcg_tms.order_job_types ojt ON oj2.type_id = ojt.id 
              WHERE ojt.category = 'service'
            )
            UPDATE rcg_tms.bills b 
            SET relation_type_id = 4
            FROM service_types s WHERE s.job_guid = b.job_guid; 
            
            -- carrier TYPES 
            WITH transport_jobs (job_guid) AS (
              SELECT guid FROM rcg_tms.order_jobs oj 
              LEFT JOIN rcg_tms.order_job_types ojt ON oj.type_id = ojt.id 
              WHERE ojt.category = 'transport'
            )
            UPDATE rcg_tms.bills b 
            SET relation_type_id = 5
            FROM transport_jobs t WHERE t.job_guid = b.job_guid;
            
            ALTER TABLE rcg_tms.invoices 
            ALTER COLUMN relation_type_id SET NOT NULL;
            
            ALTER TABLE rcg_tms.bills
            ALTER COLUMN relation_type_id SET NOT NULL;`
        );
};

exports.down = function (knex)
{
    return knex.schema.withSchema(SCHEMA_NAME)
        .alterTable(INVOICE_TABLE, table =>
        {
            table.dropForeign('relation_type_id');
            table.dropColumn('relation_type_id');
        }).alterTable(BILL_TABLE, (table) =>
        {
            table.dropForeign('relation_type_id');
            table.dropColumn('relation_type_id');
        });
};
