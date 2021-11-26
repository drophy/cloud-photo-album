const router = require('express').Router();
const aws = require('aws-sdk');
const multer = require('multer');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');

const { dbQuery } = require('./../db');

// S3 //
const s3 = new aws.S3({
    accessKeyId: process.env.aws_access_key_id,
    secretAccessKey: process.env.aws_secret_access_key,
    sessionToken: process.env.aws_session_token
});

// MULTER //
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, './temp/images/');
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname);
    },
})
const upload = multer({
    storage: storage
});

///// ROUTES /////
// Deletes the specified picture. Requires 'mediaId' and 'userId' in body params
router.delete('/', async function (req, res) {
    const userId = req.body.userId;
    const mediaId = req.body.mediaId;

    // Get image data and verify user owns image
    let getImageResult;
    try {
        getImageResult = await dbQuery(`SELECT * FROM Media WHERE UserId='${userId}' AND MediaId='${mediaId}'`);
    }
    catch (error) {
        res.status(500).send('Error: Could not reach the image at this moment');
        console.log(`Error: Could not reach the image at this moment (${error.sqlMessage})`);
        return;
    }

    if(getImageResult.length < 1) {
        res.status(400).send('Error: The image does not exist or it is not owned by the specified user');
        return;
    }

    // Delete entry from MySQL
    try {
        await dbQuery(`DELETE FROM Media WHERE MediaId='${mediaId}'`);
    }
    catch (error) {
        res.status(500).send('Error: Could not delete image from Database at this moment');
        console.log(`Error: Could not delete image from Database at this moment (${error.sqlMessage})`);
        return;
    }

    // Delete from S3
    const image = getImageResult[0];
    const extension = image.Url.substring(image.Url.lastIndexOf('.'));
    const params = { Bucket: process.env.bucket, Key: mediaId + extension };
    let deleteMediaResult;
    try {
        deleteMediaResult = s3.deleteObject(params).promise(); 
    } catch (error) {
        res.status(500).send('Error: could not delete image from AWS S3 at the moment');
        console.log(error);
        return;
    }

    // TODO: Delete from Thumbnail bucket

    res.status(200).send('Image deleted successfully');
});

router.put('/', function (req, res) {
    // TODO: update in MySQL as well
    var OLD_KEY = req.body.name;
    var NEW_KEY = req.body.newName;
    var newparams = {
        Bucket: process.env.bucket,
        CopySource: `${process.env.bucket}/${OLD_KEY}`,
        Key: NEW_KEY
    };
    var oldparams = {
        Bucket: process.env.bucket,
        Key: OLD_KEY
    };
    s3.copyObject(newparams,function (err,data) {
        s3.deleteObject(oldparams,function (er,dat) {
            if(er) throw er;
        });
        if(err) throw err;
        res.send(data);
    })
})

router.post('/', upload.single('file'), async function (req, res) {
    const name = req.body.name;
    const userId = req.body.userId;
    const folderId = req.body.folderId;
    const location = req.body.location;

    let tags;
    try {
        tags = JSON.parse(req.body.tags);    
    } catch (error) {
        res.status(400).send('Error: tags field could not be parsed as JSON');
    }

    // UPLOAD IMAGE TO S3
    const fileContent = fs.readFileSync(req.file.path);
    const mediaId = uuidv4();
    const imgExtension = name.substring(name.lastIndexOf('.'));
    const params = {
        Bucket: process.env.bucket,
        Key: mediaId + imgExtension,
        Body: fileContent,
        ACL: 'public-read' // give public access to the image
    };

    let uploadImageResult;
    try {
        uploadImageResult = await s3.upload(params).promise();    
    } catch (error) {
        res.status(500).send('Error: could not upload image to AWS S3');
        console.log(error);
        fs.remove(req.file.path);
        return;
    }

    // Remove temp copy we created in server
    fs.remove(req.file.path);
    
    // UPDATE MYSQL DB
    // Media table
    let query = `INSERT INTO Media (MediaId, UserId, ParentId, Name, Url, Location) 
                VALUES ('${mediaId}', ${userId}, ${folderId}, '${name}', '${uploadImageResult.Location}', '${location}');`;
    let mediaTableInsertResult;
    try {
        mediaTableInsertResult = await dbQuery(query);
    } catch (error) {
        res.status(400).send(error.sqlMessage || 'Error: Could not insert image into media table');
        return;
    }

    // Find folder
    query = `SELECT * FROM Folders WHERE FolderId = ${folderId}`;
    let selectFolderResult;
    try {
        selectFolderResult = await dbQuery(query);
    } catch (error) {
        res.status(400).send(error.sqlMessage || `Error: Could not find a folder with id ${folderId}`);
        return;
    }
        
    // Verify user owns the folder
    const folder = selectFolderResult[0];

    if(folder.UserId != userId) {
        res.status(400).send("Error: Folder doesn't belong to user");
        return;
    }

    // Add new media to children of parent folder
    const children = JSON.parse(folder.Children);
    children.push(mediaId);

    query = `UPDATE Folders SET Children = '${JSON.stringify(children)}' WHERE FolderId = ${folderId}`;
    try {
        await dbQuery(query);
    } catch (error) {
        res.status(400).send(error.sqlMessage || `Error: Could add picture to children of folder with id ${folderId}`);
        return;
    }

    // TODO: TAGS TABLE

    // Inform request was successful
    res.status(200).send('Image created (tags are currently ignored)');
});

module.exports = router;