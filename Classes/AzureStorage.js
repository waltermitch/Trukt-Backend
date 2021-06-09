const { BlobServiceClient } = require('@azure/storage-blob');

// init blob client
const blobServiceClient = BlobServiceClient.fromConnectionString(config.AzureStorage.connectionString);

// init container client
const container = blobServiceClient.getContainerClient(config.AzureStorage.container);

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

        // fill
        const res = await blobClient.appendBlock(fileContents, fileContents.length);

        return res;
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
}

module.exports = AzureStorage;