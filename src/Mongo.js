const { MongoClient } = require('mongodb');
const Lock = require('./MongoLock');

const dbUrl = process.env['mongo.connection.uri'];
const dbName = process.env['mongo.database'];

const dbOptions =
{
    useUnifiedTopology: false,
    useNewUrlParser: true
};

const dbCache = {};
const client = new MongoClient(dbUrl, dbOptions);
const lock = new Lock();

/**
 * YOU MUST CALL "Mongo.connect()" before using anything that involves using Mongodb
 * Mongo only needs to have 1 connection open and mutex is used to enforce that.
 * Lock is locked at the beginning and will block any and all operations from trying to access the Mongo connection
 * before the connection is established. Only way to unlock it is by calling "Mongo.connect()"
 */
class Mongo
{
    static getClient()
    {
        return client;
    }

    static async disconnect()
    {
        if (await Mongo.isConnected())
        {
            client.close();
        }
    }

    static async isConnected()
    {
        await lock.acquire();
        const connected = client?.topology && client.topology.isConnected();
        return connected;
    }

    static async connect()
    {
        if (!client?.topology || !client?.topology.isConnected())
        {
            await client.connect();
            lock.release();
        }
    }

    static async getDB(databaseName = dbName)
    {
        // this will only allow the process to continue when the mongo client makes an actual connection.
        await lock.acquire();
        if (!(databaseName in dbCache))
        {
            dbCache[databaseName] = await client.db(databaseName);
        }
        return dbCache[databaseName];
    }

    static async upsert(collection, filter, data)
    {
        const db = await Mongo.getDB();
        await db.collection(collection).updateOne(filter, { $set: data }, { upsert: true });
    }

    static async query(collection, filter, projections = {})
    {
        Object.assign(projections, { _id: 0 });
        const db = await Mongo.getDB();
        const res = await db.collection(collection).findOne(filter, { projection: projections });
        return res;
    }

    static async queryAll(collection, filter, projections)
    {
        const db = await Mongo.getDB();
        const res = await db.collection(collection).find(filter).project(projections).toArray();
        return res;
    }

    static async getSecret(query)
    {
        if (typeof query === 'string')
            query = { name: query };

        const db = await Mongo.getDB();
        const res = await db.collection('secrets').findOne(query, { projection: { _id: 0 } });
        return res;
    }

    static async updateSecret(key, data)
    {
        const db = await Mongo.getDB();
        await db.collection('secrets').updateOne({ 'name': key }, { $set: data }, { upsert: true });
    }
}

module.exports = Mongo;