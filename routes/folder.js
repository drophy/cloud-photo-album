const router = require('express').Router();

const { dbQuery } = require('./../db');

// Does the query to the DB. If requested, verifies result is not empty (useful for SELECTs). Returns null if there is an error.
async function queryDatabase(query, errorMessage="There was a problem when trying to access the database", verifyLength=false) {
    let result;
    try {
        result = await dbQuery(query)
    } catch (error) {
        console.log('Error: ' + errorMessage);
        console.log(error);
        return null;
    }
    
    if(verifyLength && (!result || result.length < 1))  return null;

    return result;
}

router.post('/', async (req, res) => {
    const name = req.body.name;
    const userId = req.body.userId;
    const folderId = req.body.folderId; // id of parent folder
    console.log(userId); // dbug

    // Find parent folder
    let query = `SELECT * FROM Folders WHERE FolderId = ${folderId}`;
    let selectFolderResult;
    try {
        selectFolderResult = await dbQuery(query);
    } catch (error) {
        res.status(400).send(error.sqlMessage || `Error: Could not find a folder with id ${folderId}`);
    }

    // CONTINUE ~ was replacing what's above
    // let errorMessage = 'Could not get parent folder';
    // const selectFolderResult = await queryDatabase(query, errorMessage, true);
    // if(selectFolderResult === null) {
    //     res.status().send(``);
    // }

    // Verify user owns the folder
    const parentFolder = selectFolderResult[0];
    if(parentFolder.UserId != userId) {
        res.status(400).send("Error: Folder doesn't belong to user");
        return;
    }

    // Create folder
    console.log(userId); // dbug
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
});

router.get('/', async (req, res) => {
    const userId = req.query.userId;
    const folderId = req.query.folderId;
    
    // Get data about the folder
    let selectFolderResult;
    try {
        selectFolderResult = await dbQuery(`SELECT * FROM Folders WHERE FolderId = ${folderId}`);
    } catch (error) {
        res.status(400).send(error.sqlMessage || `Error: Could not find a folder with id ${folderId}`);
    }
    const folderData = selectFolderResult[0];

    // Verify user owns the folder
    if(folderData.UserId != userId) {
        res.status(400).send("Error: Folder doesn't belong to user");
        return;
    }

    // Get children folders
    let getFoldersResult;
    try {
        getFoldersResult = await dbQuery(`SELECT * FROM Folders WHERE ParentId = ${folderId}`);
    } catch (error) {
        res.status(500).send(error.sqlMessage || `Error: Could not get children folders`);
        return;
    }

    const folders = getFoldersResult.map(f => { return {'folderId': f.FolderId, 'name': f.Name} });
    
    // Get children images
    let getImagesResult;
    try {
        getImagesResult = await dbQuery(`SELECT * FROM Media WHERE ParentId = ${folderId}`);
    } catch (error) {
        res.status(500).send(error.sqlMessage || `Error: Could not get images`);
        return;
    }

    const images = getImagesResult.map(i => { return {'mediaId': i.MediaId, 'name': i.Name, 'url': i.Url, 'thumbnailUrl': i.ThumbnailUrl} });

    res.status(200).send({folderName: folderData.Name, folders, images});
});

module.exports = router;