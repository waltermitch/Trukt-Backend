const { NotFoundError } = require('../ErrorHandling/Exceptions');
const PubSubService = require('../Services/PubSubService');
const OrderJob = require('../Models/OrderJob');
const Notes = require('../Models/Notes');
const Order = require('../Models/Order');
const { NOTES_TYPES } = require('../Models/Notes');
const Objection = require('objection');
const { raw } = require('objection');
const Case = require('../Models/Case');

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

    // creation of notes attached to case
    static async createCaseNotes(caseGuid, notePayload, currentUser)
    {
        const case1 = Case.fromJson({ guid: caseGuid });

        // generating case notes
        return await NotesService.genericCreator('case', case1, notePayload, currentUser);
    }

    // function for updating notes
    static async updateNote(noteGuid, notePayload)
    {
        // creating payload to update
        const note =
        {
            title: (notePayload.title || null),
            body: notePayload.body,
            type: notePayload.type,
            isDeleted: false
        };

        // find note by note GUID and patch the note and return job/order guid
        const updatedNote = await Notes.query()
            .patchAndFetchById(noteGuid, note)
            .withGraphFetched('[job, order, createdBy]');

        // not doesn't exist
        if (updatedNote == undefined)
            throw new NotFoundError('Note does not exist');

        const { parentGuid, parentName } = NotesService.buildPubSubPayload(updatedNote);

        // update pubsub accordingly
        await PubSubService.publishNote(parentGuid, parentName, updatedNote, 'updated');
    }

    // function to delete not
    static async deleteNote(noteGuid)
    {
        // find note being that needs to be deleted return job/order guid
        const updatedNote = await Notes.query()
            .patchAndFetchById(noteGuid, { isDeleted: true })
            .withGraphFetched('[job, order, createdBy]');

        // not doesn't exist
        if (!updatedNote)
            throw new NotFoundError('Note does not exist');

        const { parentGuid, parentName } = NotesService.buildPubSubPayload(updatedNote);

        // update pubsub accordingly
        await PubSubService.publishNote(parentGuid, parentName, updatedNote, 'deleted');
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

        // depending on model being job or order, publish to pubsub accordingly
        let parentName;
        if (model instanceof OrderJob)
            parentName = 'job';
        else
            parentName = 'order';

        delete note.order;
        delete note.job;

        // update pubsub accordingly
        await PubSubService.publishNote(model.guid, parentName, note, 'created');

        // return note
        return note;
    }

    static async getOrderNotes(orderGuid)
    {
        // find all notes for order, (using extra join to know if order exists)
        const notes = await Order.relatedQuery('notes')
            .for(orderGuid)
            .withGraphJoined('createdBy')
            .orderBy('dateCreated', 'desc');

        return notes;
    }

    static async getJobNotes(jobGuid, queryParams)
    {
        const { type, pg: page, rc: rowCount, order } = queryParams;

        const notesQueryBuilder = Notes.query().withGraphFetched('createdBy').alias('gn')
            .select(raw('gn.*, false as "isClientNote"'))
            .leftJoin('orderJobNotes', 'gn.guid', 'orderJobNotes.noteGuid')
            .where('orderJobNotes.jobGuid', jobGuid);
        
        // filter between job notes types
        if (type)
            notesQueryBuilder.where('gn.type', type);
        
        // get order notes (which are client notes actually ;))
        if (order)
            notesQueryBuilder.union(
                Notes.query().withGraphFetched('createdBy').alias('gn2')
                    .select(raw('gn2.*, true as "isClientNote"'))
                    .leftJoin('orderNotes', 'gn2.guid', 'orderNotes.noteGuid')
                    .rightJoin('orderJobs', 'orderNotes.orderGuid', 'orderJobs.orderGuid')
                    .where('orderJobs.guid', jobGuid)
                    .whereNotNull('gn2.guid')
            );

        const { results, total } = await notesQueryBuilder.orderBy('dateCreated', 'desc')
            .page(page, rowCount);

        return {
            results,
            page: page + 1,
            rowCount,
            total
        };
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

    static buildPubSubPayload(note)
    {
        // assigning guid
        let parentGuid;
        let parentName;

        if (note.job)
        {
            parentGuid = note.job.guid;
            parentName = 'job';
        }
        else
        {
            parentGuid = note.order.guid;
            parentName = 'order';
        }

        delete note.order;
        delete note.job;

        return { parentGuid, parentName };
    }
}

module.exports = NotesService;