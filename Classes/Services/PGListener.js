const PG = require('../PostGres');

// list of channels to listen to
const channels =
    [
        'job_status_change',
        'messages'
    ]

let client;

class PGListener
{
    static async listen()
    {
        if (!client)
        {
            // get raw connection
            client = await PG.getRawConnection();

            //subscribe to these channels
            channels.forEach((e) => client.query(`LISTEN ${e}`));

            // handle notifications
            client.on('notification', async (msg) =>
            {
                // handle notifications here...
                console.log(msg)
            })
        }
    }
}

module.exports = PGListener;