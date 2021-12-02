const router = require('express').Router();
const folderRouter = require('./routes/folder');
const imageRouter = require('./routes/image');
const imageRouterLegacy = require('./routes/image_old');
const userRouter = require('./routes/user');

router.use('/folder', folderRouter);
router.use('/image', imageRouter);
router.use('/image_legacy', imageRouterLegacy);
router.use('/user', userRouter);

module.exports = router;

