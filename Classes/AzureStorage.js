const { BlobServiceClient } = require('@azure/storage-blob');

// init blob client
const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.AzureWebJobsStorage);

class AzureStorage
{
    constructor()
    { }

    static async getBlob(containerName, blobName)
    {
        // nav to container
        const containerClient = blobServiceClient.getContainerClient(containerName);

        // get blob connection
        const blobClient = containerClient.getBlobClient(blobName);

        // download
        const buffer = await blobClient.downloadToBuffer();

        return buffer;
    }

    static async storeBlob(fileName, fileContents, containerName)
    {
        // init container connection
        const containerClient = blobServiceClient.getContainerClient(containerName);

        // init blob connection
        const blobClient = containerClient.getAppendBlobClient(fileName);

        // delete old if exists
        await blobClient.deleteIfExists();

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