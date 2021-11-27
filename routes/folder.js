const router = require('express').Router();

const { dbQuery } = require('./../db');
const Utils = require('./../utils');

router.post('/', async (req, res) => {
    console.log('-I- Reached POST /folder');
    const name = req.body.name;
    const userId = req.body.userId;
    const folderId = req.body.folderId; // id of parent folder

    // Find parent folder
    let query = `SELECT * FROM Folders WHERE FolderId = ${folderId}`;
    let errorMessage = `Error: Could not find a folder with id ${folderId}`;
    const selectFolderResult = await Utils.queryDatabase(query, errorMessage, true);
    if(selectFolderResult.status != 200) {
        res.status(selectFolderResult.status).send(errorMessage);
        return;
    }

    // Verify user owns the folder
    const parentFolder = selectFolderResult.data[0];
    if(parentFolder.UserId != userId) {
        res.status(400).send("Error: Folder doesn't belong to user");
        return;
    }

    // Create folder
    query = `INSERT INTO Folders (UserId, ParentId, Name, Children) VALUES ('${userId}', ${folderId}, '${name}', '[]');`;
    let createFolderResult;
    try {
        createFolderResult = await dbQuery(query);
    } catch (error) {
        res.status(400).send(error.sqlMessage || "Error: Could not create a new folder");
        return;
    }

    // Add new folder to children of parent
    // TODO: see if there's a better way of pushing to a JSON field
    const newFolderId = 'F' + createFolderResult.insertId;
    const children = JSON.parse(parentFolder.Children);
    children.push(newFolderId);

    query = `UPDATE Folders SET Children = '${JSON.stringify(children)}' WHERE FolderId = ${folderId}`;
    try {
        createFolderResult = await dbQuery(query);
    } catch (error) {
        res.status(400).send(error.sqlMessage || "Error: Could not add new folder to parent folder");
        return;
    }

    // Inform request was successful
    res.status(200).send('Folder created');
    console.log('-I- Folder created');
});

router.get('/', async (req, res) => {
    console.log('-I- Reached GET /folder');
    const userId = req.query.userId;
    const folderId = req.query.folderId;
    
    // Get data about the folder
    let query = `SELECT * FROM Folders WHERE FolderId = ${folderId}`
    let errorMessage = `Error: Could not find a folder with id ${folderId}`;
    const selectFolderResult = await Utils.queryDatabase(query, errorMessage, true);
    if(selectFolderResult.status !== 200) {
        res.status(selectFolderResult.status).send(errorMessage);
        return;
    }

    // Verify user owns the folder
    const folderData = selectFolderResult.data[0];
    if(folderData.UserId != userId) {
        res.status(400).send("Error: Folder doesn't belong to user");
        return;
    }

    // Get children folders
    query = `SELECT * FROM Folders WHERE ParentId = ${folderId}`;
    errorMessage = `Error: Could not get children folders`;
    const getFoldersResult = await Utils.queryDatabase(query, errorMessage, true);
    if(getFoldersResult.status !== 200) {
        res.status(getFoldersResult.status).send(errorMessage);
        return;
    }

    const folders = getFoldersResult.data.map(f => { return {'folderId': f.FolderId, 'name': f.Name} });
    
    // Get children images
    query = `SELECT * FROM Media WHERE ParentId = ${folderId}`;
    errorMessage = `Error: Could not get images`;
    const getImagesResult = await Utils.queryDatabase(query, errorMessage, true);
    if(getImagesResult.status !== 200) {
        res.status(getImagesResult.status).send(errorMessage);
        return;
    }

    const images = getImagesResult.data.map(i => { return {'mediaId': i.MediaId, 'name': i.Name, 'url': i.Url, 'thumbnailUrl': i.ThumbnailUrl} });

    res.status(200).send({folderName: folderData.Name, folders, images});
    console.log('-I- Returned folder data');
});

module.exports = router;