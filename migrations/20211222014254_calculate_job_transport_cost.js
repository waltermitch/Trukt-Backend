
exports.up = function (knex)
{
    return knex.raw(`
        -- altering table to have transport cost field
        ALTER TABLE rcg_tms.order_jobs
        ADD COLUMN transport_cost numeric(15,2) DEFAULT 0 NOT NULL; 

        -- altering table to create generated column 
        ALTER TABLE rcg_tms.order_jobs
        ADD rate_per_mile numeric(15,2) NOT NULL GENERATED ALWAYS AS (COALESCE(rcg_tms.order_jobs.transport_cost / NULLIF(rcg_tms.order_jobs.distance, 0), 0)) STORED;

        -- function to calculate that cost
        CREATE OR REPLACE FUNCTION rcg_tms.sum_of_transport_jobs()
            RETURNS trigger
            LANGUAGE 'plpgsql'
            COST 1
            VOLATILE NOT LEAKPROOF
        AS $BODY$
        	DECLARE item_ID int4;
        	DECLARE invoiceguid uuid;
            BEGIN
                IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
                	item_ID = NEW.item_id;
                	invoiceguid = NEW.invoice_guid;
                	NEW.notes = 'Made new notes';
                ELSEIF (TG_OP = 'DELETE') THEN
                	item_ID = OLD.item_id;
                	invoiceguid = OLD.invoice_guid;
                END IF;
                -- if transport type then execute the update
                IF (item_ID = 1) THEN
	    			UPDATE rcg_tms.order_jobs oj
	    			SET transport_cost = (SELECT sum(ibl.amount) AS amount 
	    									FROM rcg_tms.invoice_bill_lines ibl
	    									WHERE ibl.invoice_guid = invoiceguid
	    									AND ibl.item_id = 1 
	    									GROUP BY ibl.invoice_guid)
	    			FROM rcg_tms.invoice_bill_lines ibl, rcg_tms.bills b
	    			WHERE ibl.invoice_guid = invoiceguid
	    			AND ibl.invoice_guid = b.bill_guid 
	    			AND oj.guid = b.job_guid;
	    			RETURN NEW;
                END IF;
                RETURN NEW;
            END;
        $BODY$;

        CREATE TRIGGER rcg_sum_of_transport_jobs
            AFTER INSERT OR UPDATE OR DELETE ON rcg_tms.invoice_bill_lines 
            FOR EACH ROW EXECUTE FUNCTION rcg_tms.sum_of_transport_jobs();

        COMMENT ON TRIGGER rcg_sum_of_transport_jobs ON rcg_tms.invoice_bill_lines
            IS 'Calculates the total cost of the transport jobs';
    `);
};

exports.down = function (knex)
{
    return knex.raw(`  
        ALTER TABLE rcg_tms.order_jobs
        DROP COLUMN IF EXISTS transport_cost,
        DROP COLUMN IF EXISTS rate_per_mile;

        DROP TRIGGER IF EXISTS rcg_sum_of_transport_jobs ON rcg_tms.invoice_bill_lines;
        DROP FUNCTION IF EXISTS rcg_tms.sum_of_transport_jobs(); 
    `);
};
