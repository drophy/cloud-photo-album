console.log('SERVER IS STARTING!!! C:');

///// MODULES /////
const express = require(`express`);
const app = express();
const aws = require('aws-sdk');
const multer = require('multer');
const fs = require('fs-extra');
const { dbConnection } = require('./db');


///// CONSTANTS /////
const PORT = 3000;

// ENV //
require('dotenv').config();

// S3 //
const s3 = new aws.S3({
    accessKeyId: process.env.accessKeyId,
    secretAccessKey: process.env.secretAccessKey
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

///// MIDDLEWARE /////
app.use(express.json()); // parse JSON and place it in req.body

///// ROUTES /////
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));

app.get(`/`, (req, res) => res.send(`Welcome to Cloud Photo Album's API!!! c:`) );

// USERS //
app.post(`/create_user`, async (req, res) => {
    const email = req.body.email;
    if (!email) {
        res.status(400).send('Bad request: missing email attribute');
        return;
    }

    // Create user in Users table
    let query = `INSERT INTO Users (Email) VALUES ('${email}');`;
    dbConnection.query(query, function(error, results, fields) {
        if (error) throw error;
        console.log(results);

        // Create a root folder for user
        let userId = results.insertId;
        query = `INSERT INTO Folders (UserId, Name, Children) VALUES (${userId}, 'root', '[]');`
        dbConnection.query(query, function(error, results, fields) {
            if (error) throw error;
            console.log(results);
        });
    });
    // TODO: figure out how to catch errors (e.g. when duplicate emails are given)

    res.status(200).send('User created');
});
// TODO: Create a method to DELETE and EDIT user as well

// FOLDERS //
app.post('/create_folder', (req, res) => {
    const name = req.body.name;
    const userId = req.body.userId;
    const folderId = req.body.folderId; // id of parent folder

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

        // Create folder
        query = `INSERT INTO Folders (UserId, Name, Children) VALUES (${userId}, '${name}', '[]');`;
        dbConnection.query(query, function(error, results) {
            if (error) throw error;
            console.log(results);
            const newFolderId = 'F' + results.insertId;

            // Add new folder to children of parent
            let children = JSON.parse(folder.Children);
            children.push(newFolderId);

            query = `UPDATE Folders SET Children = '${JSON.stringify(children)}' WHERE FolderId = ${folderId}`;
            dbConnection.query(query, function(error, results) {
                if (error) throw error;
                console.log(results);

                // Inform request was successful
                res.status(200).send('Folder created');
            });
            // TODO: see if there's a better way of pushing to a JSON field
        });
    });
});

// MEDIA //

app.post('/upload_picture', upload.single('file'), function (req, res) {
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
    console.log(req.file);
    console.log(req.body);
    const fileContent = fs.readFileSync(req.file.path);
    const params = {
        Bucket: process.env.bucket,
        Key: name,
        Body: fileContent,
        ACL: 'public-read' // give public access to the image
    };
    console.log(params);
    s3.upload(params, function (err, data) {
        if (err) throw err;
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
                    res.status(200).send('Folder created');
                });
            });
        });
    });
});
app.delete('/image', function (req, res) {
    // TODO: delete from MySQL as well
    let params = { Bucket: process.env.bucket, Key: req.body.name };
    s3.deleteObject(params, function (err, data) {
        if (err) throw err;  // error
        res.send(data);
    });
});
app.put('/image', function (req, res) {
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




