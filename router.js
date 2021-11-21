const router = require('express').Router();
const imageRouter = require('./routes/image');
const userRouter = require('./routes/user');

router.use('/image', imageRouter);
router.use('/user', userRouter);

module.exports = router;

