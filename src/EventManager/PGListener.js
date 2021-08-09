const Handler = require('./Handler');
const PG = require('../PostGres');

// list of channels to listen to
const channels =
    ['job_status_change', 'account_upserted'];

let client;

class PGListener
{
    static async listen()
    {
        if (!client)
        {
            // get raw connection
            client = await PG.getRawConnection();

            console.log('Trying to Listen To DB Triggers');

            // subscribe to these channels
            channels.forEach((e) => client.query(`LISTEN ${e}`));

            // handle notifications
            client.on('notification', async (msg) =>
            {
                try
                {
                    // convert string to json
                    const jsonMsg = JSON.parse(msg.payload);

                    switch (msg.channel)
                    {
                        case 'job_status_change':
                            await Handler.jobStatusChanged(jsonMsg);
                            break;
                        case 'account_upserted':
                            await Handler.accountUpdated(jsonMsg);
                            break;
                        default:
                            break;
                    }

                    console.log('DB Trigger: 200');

                }
                catch (err)
                {
                    const error = err?.response?.data || err?.response || err;
                    console.log(JSON.stringify(error));
                }
            });

        }
    }
}

module.exports = PGListener;