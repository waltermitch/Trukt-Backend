const Microsoft = require('../Azure/Microsoft');
const jwt = require('jsonwebtoken');

const appId = process.env['azure.ad.appId'];
const invalidToken = { 'status': 401, 'data': 'Invalid Token' };

class Auth
{
    static async verifyJWT(token)
    {
        if (!token)
            throw invalidToken;

        // remove bearer and ensure no empty strings
        const cleanToken = Auth.extractToken(token);

        // decode full token
        const decoded = jwt.decode(cleanToken, { complete: true });

        // oid is the unique identifier for the user
        // aud is the audience for the token (groupId)
        if (!decoded || !decoded.payload?.oid || decoded.payload?.aud != appId)
            throw invalidToken;

        // get keys
        const keys = await Microsoft.getKeys();

        // try to validate token
        try
        {
            return jwt.verify(cleanToken, keys.get(decoded?.header?.kid).secret);
        }
        catch (err)
        {
            throw invalidToken;
        }
    }

    static extractToken(bearer)
    {
        const token = bearer.split(' ')[1];

        // verify length
        if (token?.length <= 40 || !token?.startsWith('e'))
            throw invalidToken;

        return token;
    }
}

module.exports = Auth;