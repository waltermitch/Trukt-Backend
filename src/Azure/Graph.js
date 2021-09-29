const HTTPS = require('../AuthController');

const opts =
{
    url: 'https://graph.microsoft.com',
    tokenName: 'internal_graph_api_access_token'
};

let api;

class Graph
{
    static async connect()
    {
        if (!api?.expCheck())
        {
            // get token
            const token = await HTTPS.getSecret({ 'name': opts.tokenName });

            // check for instance
            if (!api?.instance)
            {
                api = new HTTPS(opts);

                api.connect();
            }

            // set exp
            api.exp = token.exp;

            // update token
            api.setToken(token.value);
        }

        return api.instance;
    }

    static async getGroupMembers(groupId)
    {
        const graph = await Graph.connect();

        const members = await graph.get(`/v1.0/groups/${groupId}/members`);

        return members.data.value;
    }
}

module.exports = Graph;