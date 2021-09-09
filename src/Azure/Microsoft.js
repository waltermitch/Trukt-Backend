const HTTPS = require('../AuthController');
const NodeCache = require('node-cache');
const jwktopem = require('jwk-to-pem');

const cache = new NodeCache({ deleteOnExpire: true, stdTTL: 60 * 60 * 24 });

const tenantId = process.env['azure.ad.tenantId'];
const appId = process.env['azure.ad.appId'];

const opts = { url: 'https://login.microsoftonline.com' };

const api = new HTTPS(opts).connect();

class Microsoft
{
    static async getKeys()
    {
        if (!cache.has('keys'))
        {
            // get the keys
            const res = await api.get(`/${tenantId}/discovery/v2.0/keys?appId=${appId}`);

            const keys = new Map();

            // init the keys
            for (const key of res.data.keys)
            {
                const parsedKey = jwktopem(key);

                keys.set(key.kid, { 'secret': parsedKey });
            }

            cache.set('keys', keys);
        }

        return cache.get('keys');
    }

    static async getTokenROPC(clientId, clientSecret, username, password, scope = 'user.read openid profile offline_access')
    {
        const params = new URLSearchParams();

        params.append('grant_type', 'password');
        params.append('scope', scope);
        params.append('client_id', clientId);
        params.append('client_secret', clientSecret);
        params.append('username', username);
        params.append('password', password);

        const res = await api.post(`/${tenantId}/oauth2/v2.0/token`, params, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

        return res.data;
    }
}

module.exports = Microsoft;