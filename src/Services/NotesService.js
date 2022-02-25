const OrderJob = require('../Models/OrderJob');
const pubsub = require('../Azure/PubSub');
const Notes = require('../Models/Notes');
const Order = require('../Models/Order');
const { NotFoundError } = require('../ErrorHandling/Exceptions');

class NotesService
{
    // creation of internal notes attached to job
    static async createInternalNotes(jobGuid, notePayload, currentUser)
    {
        // create job model object to link notes to job
        const job = OrderJob.fromJson({ guid: jobGuid });

        // generating internal notes
        return await NotesService.genericCreator('job', job, notePayload, currentUser);
    }

    // creation of external notes, client notes
    static async createClientNotes(orderGuid, notePayload, currentUser)
    {
        // create order model object to link notes to order
        const order = Order.fromJson({ guid: orderGuid });

        // generating cleint notes
        return await NotesService.genericCreator('order', order, notePayload, currentUser);
    }

    // function for updating notes
    static async updateNote(noteGuid, notePayload)
    {
        // creating payload to update
        const note = {
            title: (notePayload.title || null),
            body: notePayload.body,
            type: notePayload.type,
            isDeleted: false
        };

        // find note by note GUID and patch the note and return job/order guid
        const updatedNote = await Notes.query().patchAndFetchById(noteGuid, note).withGraphFetched('[job, order, createdBy]');

        // not doesn't exist
        if (updatedNote == undefined)
        {
            throw new NotFoundError('Note does not exist');
        }

        // assigning guid
        const guid = updatedNote.job?.guid || updatedNote.order?.guid;

        // removing job/order fields to update sub with payload
        delete updatedNote.order;
        delete updatedNote.job;

        // update pubsub accordingly
        await pubsub.publishToGroup(guid, { object: 'note', data: updatedNote });
    }

    // function to delete not
    static async deleteNote(noteGuid)
    {
        // find note being that needs to be deleted return job/order guid
        const updatedNote = await Notes.query().patchAndFetchById(noteGuid, { isDeleted: true }).withGraphFetched('[job, order, createdBy]');

        // not doesn't exist
        if (!updatedNote)
            throw new NotFoundError('Note does not exist');

        // assigning guid
        const guid = updatedNote.job?.guid || updatedNote.order?.guid;

        // removing job/order fields to update sub with payload
        delete updatedNote.order;
        delete updatedNote.job;

        // update pubsub accordingly
        await pubsub.publishToGroup(guid, { object: 'note', data: updatedNote.guid });
    }

    // to create any note
    static async genericCreator(name, model, notePayload, currentUser)
    {
        // composing payload
        const notes = Notes.fromJson(notePayload);

        // adding current user
        notes.setCreatedBy(currentUser);

        // linking models to propper table order/job
        notes.graphLink(name, model);

        // insert note into table with conjustion
        const createdNote = await Notes.query().insertGraph(notes, { allowRefs: true, relate: true });

        // get related user
        const note = await Notes.query().findById(createdNote.guid).withGraphFetched('createdBy');

        // update pubsub accordingly
        await pubsub.publishToGroup(`${model.guid}`, { object: 'note', data: note });

        // return full note
        return note;
    }

    static async getOrderNotes(orderGuid)
    {
        // find all notes for order, (using extra join to know if order exists)
        const order = await Order.query().findById(orderGuid).withGraphJoined('notes(notDeleted).[createdBy]');

        if (!order)
            return null;

        // return notes
        return order.notes;
    }

    static async getJobNotes(jobGuid)
    {
        // find all notes for job, (using extra join to know if job exists)
        const job = await OrderJob.query().findById(jobGuid).withGraphJoined('notes(notDeleted).[createdBy]').orderBy('notes:dateCreated', 'desc');

        if (!job)
            return null;

        // return notes
        return job?.notes;
    }

    // get all notes for an order
    static async getAllNotes(orderGuid)
    {
        // find all notes for order and jobs, (using extra join to know if order exists)
        const order = await Order.query().findById(orderGuid).withGraphJoined('[notes(notDeleted).[createdBy], jobs.[notes(notDeleted).[createdBy]]]').orderBy('jobs:notes:dateCreated', 'desc');

        if (!order)
            return null;

        const jobNotes = {};
        for (const job of order.jobs)
            jobNotes[job.guid] = job.notes;

        // return notes
        return {
            'order': order.notes,
            'jobs': jobNotes
        };
    }
}

module.exports = NotesService;