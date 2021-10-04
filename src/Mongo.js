const { MongoClient } = require('mongodb');

const dbUrl = process.env['mongo.connection.uri'];
const dbName = process.env['mongo.database'];

const dbOptions =
{
    useUnifiedTopology: false,
    useNewUrlParser: true
};

const mongoclient = new MongoClient(dbUrl, dbOptions);
let db;
let client;

class Mongo
{
    static getClient()
    {
        return client;
    }
    static getDB()
    {
        return db;
    }
    static getMongoClient()
    {
        return mongoclient;
    }

    static async connect(databaseName = dbName)
    {
        if (!db && !client)
        {
            client = await mongoclient.connect();
            db = client.db(databaseName);
        }

        return db;
    }

    static async upsert(collection, filter, data)
    {
        const db = await Mongo.connect();

        await db.collection(collection).updateOne(filter, { $set: data }, { upsert: true });
    }

    static async query(collection, filter, projections = {})
    {
        Object.assign(projections, { _id: 0 });

        const db = await Mongo.connect();

        const res = await db.collection(collection).findOne(filter, { projection: projections });

        return res;
    }

    static async queryAll(collection, filter, projections)
    {
        const db = await Mongo.connect();

        const res = await db.collection(collection).find(filter).project(projections).toArray();

        return res;
    }

    static async getSecret(query)
    {
        if (typeof query === 'string')
            query = { name: query };

        const db = await Mongo.connect();

        const res = await db.collection('secrets').findOne(query, { projection: { _id: 0 } });

        return res;
    }

    static async updateSecret(key, data)
    {
        const db = await Mongo.connect();

        await db.collection('secrets').updateOne({ 'name': key }, { $set: data }, { upsert: true });
    }
}

module.exports = Mongo;