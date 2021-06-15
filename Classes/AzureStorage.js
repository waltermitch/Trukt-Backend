const { BlobServiceClient } = require('@azure/storage-blob');
require('../tools/start')();

// init blob client
const blobServiceClient = BlobServiceClient.fromConnectionString(config.AzureStorage.connectionString);

// init container client
const container = blobServiceClient.getContainerClient(config.AzureStorage.container);

// amount to upload by;
const ThreeMB = 3000000;

class AzureStorage
{
    constructor()
    { }

    static async storeBlob(fileName, fileContents)
    {
        // init blob connection
        const blobClient = container.getAppendBlobClient(fileName);

        // init empty blob
        await blobClient.create();

        // fill with chunks
        await AzureStorage.storeChunks(fileContents, blobClient);

        return;
    }

    static async storeChunks(data, blobClient)
    {
        for (let i = 0; i < data.length; i++)
        {
            // set right index
            let diff = i + ThreeMB;

            if (i + ThreeMB > data.length)
                diff = data.length;

            // extract chunk
            const chunk = data.slice(i, diff);

            // upload
            await blobClient.appendBlock(chunk, chunk.length);

            // move up left index
            i = diff;
        }
    }

    static async storeJSON(fileName, data, container)
    {
        const json = JSON.stringify(data);

        return await AzureStorage.storeBlob(fileName, json, container);
    }

    static async getJSONFile(fileName, container)
    {
        const file = await AzureStorage.getBlob(fileName, container);

        return JSON.parse(file.toString());
    }

    static getBaseUrl()
    {
        return `https://rcgfilestorage.blob.core.windows.net/${config.AzureStorage.container}`;
    }
}

module.exports = AzureStorage;