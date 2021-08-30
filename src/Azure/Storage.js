const { BlobServiceClient, ContainerSASPermissions, generateBlobSASQueryParameters, StorageSharedKeyCredential } = require('@azure/storage-blob');
const { DateTime } = require('luxon');

const connectionString = process.env['azure.storage.connectionString'];
const containerName = process.env['azure.storage.container'];

// init blob client
const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);

// init container client
const container = blobServiceClient.getContainerClient(containerName);

// amount to upload by;
const ThreeMB = 3000000;

// static sas
const sas = {};

class AzureStorage
{
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
        return `https://rcgfilestorage.blob.core.windows.net/${containerName}`;
    }

    static getSAS()
    {
        if (!sas?.exp || sas?.exp < DateTime.utc().toString())
        {
            // compose option
            const opts =
            {
                containerName: containerName,
                permissions: ContainerSASPermissions.parse('r'),
                expiresOn: DateTime.utc().plus({ day: 1 }).toJSDate()
            };

            // parse conn string
            const { AccountKey, AccountName } = AzureStorage.parseConnectionString(connectionString);

            // init credential
            const sharedKeyCredential = new StorageSharedKeyCredential(AccountName, AccountKey);

            return '?' + generateBlobSASQueryParameters(opts, sharedKeyCredential).toString();
        }
    }

    static parseConnectionString(string)
    {
        const arr = string.split(';');
        const obj = {};

        for (const param of arr)
        {
            const temp = param.split('=');

            obj[`${temp[0]}`] = temp[1];
        }

        return obj;
    }
}

module.exports = AzureStorage;