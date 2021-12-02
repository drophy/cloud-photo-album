const router = require('express').Router();

const { dbQuery } = require('./../db');
const Utils = require('./../utils');

///// ROUTES /////
router.post('/', async (req, res) => {
    console.log('-I- Reached POST /folder');
    const name = req.body.name;
    const userId = req.body.userId;
    const folderId = req.body.folderId; // id of parent folder

    // Find parent folder
    let query = `SELECT * FROM Folders WHERE FolderId = ${folderId}`;
    let errorMessage = `Could not find a folder with id ${folderId}`;
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
    const getFolderResult = await getFolder(folderId);
    if(getFolderResult.status !== 200) {
        res.status(getFolderResult.status).send(getFolderResult.data);
        return;
    }
    const folderData = getFolderResult.data;

    // Verify user owns the folder
    if(folderData.UserId != userId) {
        res.status(400).send("Error: Folder doesn't belong to user");
        return;
    }

    // Get children folders
    query = `SELECT * FROM Folders WHERE ParentId = ${folderId} ORDER BY Name`;
    errorMessage = `Could not get children folders`;
    const getFoldersResult = await Utils.queryDatabase(query, errorMessage);
    if(getFoldersResult.status !== 200) {
        res.status(getFoldersResult.status).send(errorMessage);
        return;
    }

    const folders = getFoldersResult.data.map(f => { return {'folderId': f.FolderId, 'name': f.Name} });
    
    // Get children images
    query = `SELECT * FROM Media WHERE ParentId = ${folderId} ORDER BY Name`;
    errorMessage = `Could not get images`;
    const getImagesResult = await Utils.queryDatabase(query, errorMessage);
    if(getImagesResult.status !== 200) {
        res.status(getImagesResult.status).send(errorMessage);
        return;
    }

    const images = getImagesResult.data.map(i => { return {'mediaId': i.MediaId, 'name': i.Name, 'url': i.Url, 'thumbnailUrl': i.ThumbnailUrl} });

    res.status(200).send({folderName: folderData.Name, folders, images});
    console.log('-I- Returned folder data');
});

router.delete('/', async (req, res) => {
    console.log(`-I- Reached DELETE /folder"`);
    const userId = req.body.userId;
    const folderId = req.body.folderId;

    // Get data about the folder
    const getFolderResult = await getFolder(folderId);
    if(getFolderResult.status !== 200) {
        res.status(getFolderResult.status).send(getFolderResult.data);
        return;
    }
    const folderData = getFolderResult.data;

    // Verify user owns the folder
    if(folderData.UserId != userId) {
        res.status(400).send("-E- Error: Folder doesn't belong to user");
        console.log('Operation canceled because user did not own folder');
        return;
    }
    // Verify it's not a root folder
    if(folderData.ParentId == -1) {
        res.status(400).send("-E- Error: Root folders can not be deleted");
        console.log('Operation canceled because folder is a root folder');
        return;
    }

    // Get children
    const childrenData = await getDescendantItems(folderId);
    if(childrenData.error) {
        res.status(500).send('-E- Could not access children items of folder');
    }

    const folderIds = childrenData.folders;
    folderIds.push(folderId); // add current folderId so we can delete it too
    console.log(folderIds);

    const imageIds = childrenData.images.map(i => `"${i.mediaId}"`);
    const s3Keys = childrenData.images.map(i => i.mediaId + i.extension);
    console.log(s3Keys);

    // TODO: Delete images from S3 - send s3Keys to other server
    
    // Delete images
    let query, errorMessage;
    if(imageIds.length > 0) {
        query = `DELETE FROM Media WHERE MediaId IN(${imageIds.join(', ')})`;
        errorMessage = `Could not delete children images`;
        const deleteImagesResult = await Utils.queryDatabase(query, errorMessage, true);
        if(deleteImagesResult.status !== 200) {
            res.status(deleteImagesResult.status).send(errorMessage);
            return;
        }
    }

    // Delete folders
    query = `DELETE FROM Folders WHERE FolderId IN(${folderIds.join(', ')})`;
    errorMessage = `Could not delete folder`;
    const deleteFoldersResult = await Utils.queryDatabase(query, errorMessage, true);
    if(deleteFoldersResult.status !== 200) {
        res.status(deleteFoldersResult.status).send(errorMessage);
        return;
    }

    res.status(200).send(`Deleted ${folderIds.length} folders and ${imageIds.length} images`);
    console.log(`Deleted ${folderIds.length} folders and ${imageIds.length} images`);
});

// Returns the folders and images of the user that contain 'searchTerm' in their name
// This is (currently) regardless of the folder they're in
router.get('/search', async (req, res) => {
    console.log(`-I- Reached GET /folder/search with query "${req.query.query}"`);
    const userId = req.query.userId;
    const searchTerm = req.query.query || '';

    // Get matching folders
    query = `SELECT * FROM Folders WHERE UserId = "${userId}" AND Name LIKE "%${searchTerm}%" ORDER BY Name`;
    errorMessage = `Could not get children folders`;
    const getFoldersResult = await Utils.queryDatabase(query, errorMessage);
    if(getFoldersResult.status !== 200) {
        res.status(getFoldersResult.status).send(errorMessage);
        return;
    }

    const folders = getFoldersResult.data.map(f => { return {'folderId': f.FolderId, 'name': f.Name} });

    // Find matching images
    query = `SELECT * FROM Media WHERE UserId = "${userId}" AND Name LIKE "%${searchTerm}%" ORDER BY Name`;
    errorMessage = `Could not get images`;
    const getImagesResult = await Utils.queryDatabase(query, errorMessage);
    if(getImagesResult.status !== 200) {
        res.status(getImagesResult.status).send(errorMessage);
        return;
    }

    const images = getImagesResult.data.map(i => { return {'mediaId': i.MediaId, 'name': i.Name, 'url': i.Url, 'thumbnailUrl': i.ThumbnailUrl} });

    res.status(200).send({folders, images});
    console.log(`-I- Returned results for query`);
});

///// FUNCTIONS /////
// Returns object of form {status: 200, data: folderObj} or {status: X00, data: errorMessage}
async function getFolder(folderId) {
    const query = `SELECT * FROM Folders WHERE FolderId = ${folderId}`;
    const errorMessage = `Could not find a folder with id ${folderId}`;
    const selectFolderResult = await Utils.queryDatabase(query, errorMessage, true);
    
    if(selectFolderResult.status === 200) selectFolderResult.data = selectFolderResult.data[0];
    else selectFolderResult.data = errorMessage;
    return selectFolderResult;
}

// Returns an object of form {error: bool, folders: [id, id, ...], images: [{mediaId, extension}, ...]}
async function getDescendantItems(folderId) {
    const descFolderIds = [];
    const descImageIds = [];

    const result = await getDescendantItemsRecursive(folderId, descFolderIds, descImageIds);
    return {error: result == -1? true : false, folders: descFolderIds, images: descImageIds};
}

async function getDescendantItemsRecursive(folderId, folderIds, imageIds) {
    // Get children images
    let query = `SELECT MediaId, Name FROM Media WHERE ParentId = ${folderId}`;
    let errorMessage = `Could not get children images`;
    const getImagesResult = await Utils.queryDatabase(query, errorMessage);
    if(getImagesResult.status !== 200) return -1;

    for (const i of getImagesResult.data) {
        // console.log(`Adding image ${i.Name}`);
        let extension = i.Name.substring(i.Name.lastIndexOf('.'));
        imageIds.push({mediaId: i.MediaId, extension});
    }

    // Get children folders
    query = `SELECT FolderId, Name FROM Folders WHERE ParentId = ${folderId}`;
    errorMessage = `Could not get children folders`;
    const getFoldersResult = await Utils.queryDatabase(query, errorMessage);
    if(getFoldersResult.status !== 200) return -1;

    // Recursive for each child folder
    for (const f of getFoldersResult.data) {
        // console.log(`Adding folder ${f.Name}`);
        folderIds.push(f.FolderId);
        let res = await getDescendantItemsRecursive(f.FolderId, folderIds, imageIds);
        if(res === -1) return -1;
    }

    return 0;
}

module.exports = router;