const FUNCTION_NAME = 'line_sum_trigger';
const trigger1Name = 'rcg_lines_trigger_update';
const TABLE_NAME = 'invoice_bill_lines';

const LINKS_FUNCTION_NAME = 'line_links_calc';
const LINKS_TRIGGER_NAME = 'rcg_lines_links_trigger_update';
const LINKS_TABLE_NAME = 'invoice_bill_line_links';

exports.up = function(knex)
{
  return knex.raw(`
        CREATE OR REPLACE FUNCTION rcg_tms.${FUNCTION_NAME}()
            returns trigger 
            VOLATILE NOT LEAKPROOF
            AS $function$
        DECLARE
            is_revenue boolean;
            is_order_line boolean;
            order_guid uuid;
            job_guid uuid;
            amount decimal;
            actual_rev decimal;
        BEGIN
            -- first figure out if line is for order or for job, require different queries
            select count(*) > 0 from rcg_tms.invoices i where i.invoice_guid = COALESCE(NEW.invoice_guid, OLD.invoice_guid) into is_order_line;

            select (ibli.type = 'revenue') from rcg_tms.invoice_bill_line_items ibli where ibli.id = COALESCE(NEW.item_id, OLD.item_id) into is_revenue;
            
            IF (is_order_line is true) THEN
                select i.order_guid from rcg_tms.invoices i where i.invoice_guid = COALESCE(NEW.invoice_guid, OLD.invoice_guid) into order_guid;
                
                select b.job_guid from rcg_tms.bills b 
                right join rcg_tms.invoice_bill_lines ibl 
                on ibl.invoice_guid = b.bill_guid
                right join rcg_tms.invoice_bill_line_links ibll
                on (ibll.line2_guid = ibl.guid) or 
                (ibll.line1_guid = ibl.guid)
                where (ibll.line2_guid = ibl.guid and ibll.line1_guid = COALESCE(NEW.guid, OLD.guid)) or 
                (ibll.line1_guid = ibl.guid and ibll.line2_guid = COALESCE(NEW.guid, OLD.guid))
                into job_guid;

                raise notice 'is order line';
                raise notice 'order guid % ', order_guid;
                raise notice 'job guid % ', job_guid;

            ELSE
                select b.job_guid, oj.order_guid from rcg_tms.bills b left join rcg_tms.order_jobs oj on oj.guid = b.job_guid 
                where b.bill_guid = COALESCE(NEW.invoice_guid, OLD.invoice_guid) into job_guid, order_guid;

           END IF;

            IF (TG_OP = 'UPDATE') THEN
                IF (TG_WHEN = 'BEFORE') THEN
                    IF(OLD.is_deleted is true AND NEW.is_deleted is true) THEN
                        RAISE EXCEPTION 'Updating forbiden on invoice bill line: (%), record is deleted', NEW.guid;
                    END IF;
                ELSIF (TG_WHEN = 'AFTER') THEN
                    amount = NEW.amount - OLD.amount;
                    -- soft delete scenario, same action as a hard delete
                    IF(NEW.is_deleted is true AND OLD.is_deleted is false) THEN
                        IF (is_revenue = is_order_line) THEN 
                            update rcg_tms.orders set actual_revenue = actual_revenue - OLD.amount,
                            actual_income = actual_income - OLD.amount
                            where guid = order_guid;

                            update rcg_tms.order_jobs set actual_revenue = actual_revenue - OLD.amount,
                            actual_income = actual_income - OLD.amount
                            where guid = job_guid;
                        ELSE
                            update rcg_tms.orders set actual_expense = actual_expense - OLD.amount,
                            actual_income = actual_income + OLD.amount
                            where guid = order_guid;

                            update rcg_tms.order_jobs set actual_expense = actual_expense - OLD.amount,
                            actual_income = actual_income + OLD.amount
                            where guid = job_guid;
                        END IF;
                    -- soft undelete scenario, same action as an insert
                    ELSIF(OLD.is_deleted is true AND NEW.is_deleted is false) THEN
                        IF (is_revenue = is_order_line) THEN 
                            update rcg_tms.orders set actual_revenue = actual_revenue + NEW.amount,
                            actual_income = actual_income + NEW.amount
                            where guid = order_guid;

                            update rcg_tms.order_jobs set actual_revenue = actual_revenue + NEW.amount,
                            actual_income = actual_income + NEW.amount
                            where guid = job_guid;
                        ELSE
                            update rcg_tms.orders set actual_expense = actual_expense + NEW.amount,
                            actual_income = actual_income - NEW.amount
                            where guid = order_guid;

                            update rcg_tms.order_jobs set actual_expense = actual_expense + NEW.amount,
                            actual_income = actual_income - NEW.amount
                            where guid = job_guid;
                        END IF;
                    -- updating active line
                    ELSIF(NEW.amount <> OLD.amount) THEN
                        IF (is_order_line = is_revenue) THEN 
                            update rcg_tms.orders set actual_revenue = actual_revenue + amount,
                            actual_income = actual_income + amount
                            where guid = order_guid;

                            update rcg_tms.order_jobs set actual_revenue = actual_revenue + amount,
                            actual_income = actual_income + amount
                            where guid = job_guid;
                        ELSE
                            update rcg_tms.orders set actual_expense = actual_expense + amount,
                            actual_income = actual_income - amount
                            where guid = order_guid;

                            update rcg_tms.order_jobs set actual_expense = actual_expense + amount,
                            actual_income = actual_income - amount
                            where guid = job_guid;     
                        END IF;
                    END IF;
                END IF;
            ELSEIF (TG_OP = 'INSERT') THEN
                IF (is_order_line = is_revenue) THEN 
                    update rcg_tms.orders set actual_revenue = actual_revenue + NEW.amount,
                    actual_income = actual_income + NEW.amount
                    where guid = order_guid;

                    update rcg_tms.order_jobs set actual_revenue = actual_revenue + NEW.amount,
                    actual_income = actual_income + NEW.amount
                    where guid = job_guid;
                ELSE
                    update rcg_tms.orders set actual_expense = actual_expense + NEW.amount,
                    actual_income = actual_income - NEW.amount
                    where guid = order_guid;

                    update rcg_tms.order_jobs set actual_expense = actual_expense + NEW.amount,
                    actual_income = actual_income - NEW.amount
                    where guid = job_guid;
                END IF;
            ELSEIF (TG_OP = 'DELETE') THEN
                IF (OLD.is_deleted is false) THEN
                     IF (is_revenue = is_order_line) THEN 
                        update rcg_tms.orders set actual_revenue = actual_revenue - OLD.amount,
                        actual_income = actual_income - OLD.amount
                        where guid = order_guid;

                        update rcg_tms.order_jobs set actual_revenue = actual_revenue - OLD.amount,
                        actual_income = actual_income - OLD.amount
                        where guid = job_guid;
                    ELSE
                        update rcg_tms.orders set actual_expense = actual_expense - OLD.amount,
                        actual_income = actual_income + OLD.amount
                        where guid = order_guid;

                        update rcg_tms.order_jobs set actual_expense = actual_expense - OLD.amount,
                        actual_income = actual_income + OLD.amount
                        where guid = job_guid; 
                    END IF;     
                END IF;
            END IF;
            RETURN NEW;
        END;
        $function$ LANGUAGE plpgsql;



        CREATE OR REPLACE FUNCTION rcg_tms.${LINKS_FUNCTION_NAME}()
            returns trigger 
            VOLATILE NOT LEAKPROOF
            AS $function$
        DECLARE
        job_guid uuid;
        is_revenue boolean;
        invoice_line_guid uuid;
        invoice_line_amount decimal;
        BEGIN
            select ibl.guid, ibl.amount from rcg_tms.invoice_bill_lines ibl 
            left join rcg_tms.invoices i 
            on ibl.invoice_guid = i.invoice_guid 
            where (ibl.guid = COALESCE(NEW.line1_guid, OLD.line1_guid)
            or ibl.guid = COALESCE(NEW.line2_guid, OLD.line2_guid)) 
            and ibl.invoice_guid = i.invoice_guid
            into invoice_line_guid, invoice_line_amount;

            select b.job_guid, (ibli.type = 'revenue') from rcg_tms.invoice_bill_lines ibl 
            left join rcg_tms.bills b 
            on ibl.invoice_guid = b.bill_guid 
            left join rcg_tms.invoice_bill_line_items ibli
            on ibl.item_id = ibli.id
            where (ibl.guid in (COALESCE(NEW.line1_guid,OLD.line1_guid), COALESCE(NEW.line2_guid, OLD.line2_guid)) and ibl.guid <> invoice_line_guid) 
            and ibl.invoice_guid = b.bill_guid
            into job_guid, is_revenue;

            IF (TG_OP = 'INSERT') THEN
                IF (is_revenue is true) THEN
                    update rcg_tms.order_jobs set actual_revenue = actual_revenue + invoice_line_amount,
                    actual_income = actual_income + invoice_line_amount
                    where guid = job_guid; 
                ELSE
                    update rcg_tms.order_jobs set actual_expense = actual_expense + invoice_line_amount,
                    actual_income = actual_income - invoice_line_amount
                    where guid = job_guid;
                END IF;
            ELSIF (TG_OP = 'UPDATE') THEN
                RAISE EXCEPTION 'Updating records on this table is forbidden.';
            ELSIF (TG_OP = 'DELETE') THEN
                IF (is_revenue is true) THEN
                    update rcg_tms.order_jobs set actual_revenue = actual_revenue - invoice_line_amount,
                    actual_income = actual_income - invoice_line_amount
                    where guid = job_guid;
                ELSE
                    update rcg_tms.order_jobs set actual_expense = actual_expense - invoice_line_amount,
                    actual_income = actual_income + invoice_line_amount
                    where guid = job_guid;
                END IF;
            END IF;
            RETURN NEW;
        END;
        $function$ LANGUAGE plpgsql;

        
    CREATE TRIGGER ${trigger1Name}
    AFTER INSERT OR UPDATE OR DELETE 
    ON rcg_tms.invoice_bill_lines
    FOR EACH ROW
    EXECUTE FUNCTION ${FUNCTION_NAME}();

    CREATE TRIGGER preventPriceChange
    BEFORE UPDATE
    ON rcg_tms.invoice_bill_lines
    FOR EACH ROW
    EXECUTE FUNCTION ${FUNCTION_NAME}();

    CREATE TRIGGER ${LINKS_TRIGGER_NAME}
    AFTER INSERT OR UPDATE OR DELETE 
    ON rcg_tms.${LINKS_TABLE_NAME}
    FOR EACH ROW
    EXECUTE FUNCTION ${LINKS_FUNCTION_NAME}();

  `);
};

exports.down = function(knex)
{
    return knex.raw(`  
    DROP TRIGGER ${trigger1Name} ON rcg_tms.${TABLE_NAME};
    DROP TRIGGER preventpricechange ON rcg_tms.${TABLE_NAME};
    DROP TRIGGER ${LINKS_TRIGGER_NAME} ON rcg_tms.${LINKS_TABLE_NAME};
    DROP FUNCTION rcg_tms.${FUNCTION_NAME}();
    DROP FUNCTION rcg_tms.${LINKS_FUNCTION_NAME}();`);
};
