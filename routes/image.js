const router = require('express').Router();
const aws = require('aws-sdk');
const multer = require('multer');
const fs = require('fs-extra');

const { dbConnection } = require('./../db');

// S3 //
const s3 = new aws.S3({
    accessKeyId: process.env.aws_access_key_id,
    secretAccessKey: process.env.aws_secret_access_key,
    sessionToken: process.env.aws_session_token
});

// MULTER //
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, './uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname);
    },
})
const upload = multer({
    storage: storage
});

///// ROUTES /////
router.delete('/', function (req, res) {
    // TODO: delete from MySQL as well
    let params = { Bucket: process.env.bucket, Key: req.body.name };
    s3.deleteObject(params, function (err, data) {
        if (err) throw err;  // error
        res.send(data);
    });
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

router.post('/', upload.single('file'), function (req, res) {
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
    

    // UPLOAD TO S3
    const fileContent = fs.readFileSync(req.file.path);
    const params = {
        Bucket: process.env.bucket,
        Key: name,
        Body: fileContent,
        ACL: 'public-read' // give public access to the image
    };
    console.log('Uploading to S3...');
    s3.upload(params, function (err, data) {
        if (err) { console.log('YUP, error was here'); throw err; }
        console.log(`File uploaded successfully. ${data.Location}`);
        fs.remove(req.file.path);

        // UPDATE MYSQL
        // Media table
        let query = `INSERT INTO Media (UserId, Name, Url, Location) VALUES (${userId}, '${name}', '${data.Location}', '${location}');`;
        dbConnection.query(query, function(error, results, fields) {
            if (error) throw error; 
            console.log(results);

            const mediaId = 'M' + results.insertId;

            // Folder Table
            query = `SELECT * FROM Folders WHERE FolderId = ${folderId}`;
            dbConnection.query(query, function(error, results, fields) {
                if (error) throw error;
                console.log(results);
                const folder = results[0];
        
                // Verify user owns the folder
                if(folder.UserId != userId) {
                    res.status(400).send("Error: Folder doesn't belong to user");
                    return;
                }
        
                // Add new media to children of parent folder
                let children = JSON.parse(folder.Children);
                children.push(mediaId);

                query = `UPDATE Folders SET Children = '${JSON.stringify(children)}' WHERE FolderId = ${folderId}`;
                dbConnection.query(query, function(error, results) {
                    if (error) throw error;
                    console.log(results);

                    // TODO: TAGS TABLE
                    

                    // Inform request was successful
                    res.status(200).send('Image created');
                });
            });
        });
    });
});

module.exports = router;