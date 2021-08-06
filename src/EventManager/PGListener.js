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

            // subscribe to these channels
            channels.forEach((e) => client.query(`LISTEN ${e}`));

            // handle notifications
            client.on('notification', async (msg) =>
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
            });
        }
    }
}

module.exports = PGListener;