'use strict';

const express = require('express');
const { check, validationResult } = require('express-validator');
const nameValidator = check('name');
const bcryptjs = require('bcryptjs');
const auth = require('basic-auth');
const Sequelize = require('sequelize');
const User = require('./models').User;
const Course = require('./models').Course;
const morgan = require('morgan');


// Construct a router instance.
const router = express.Router();

function asyncHandler(cb) {
    return async (req, res, next) => {
        try {
            await cb(req, res, next)
        } catch (error) {
            res.status(500).send(error);
        }
    }
}

// Authenticate user
const authenticateUser = async (req, res, next) => {
    let message = null;

    // Parse the user's credentials from the Authorization header.
    const credentials = auth(req);

    // If the user's credentials are available...
    if (credentials) {

        const users = await User.findAll();
        const user = await users.find(user => user.emailAddress === credentials.name);

        // If a user was successfully retrieved from the data store...
        if (user) {
            // Use the bcryptjs npm package to compare the user's password
            const authenticated = bcryptjs
                .compareSync(credentials.pass, user.password);
            // If the passwords match...
            if (authenticated) {
                console.log(`Authentication successful for username: ${user.firstName} ${user.lastName}.`);

                req.currentUser = user;
            } else {
                message = `Authentication failure for username: ${user.firstName} ${user.lastName}.`;
            }
        } else {
            message = `User not found for username: ${credentials.name}`;
        }
    } else {
        message = 'Auth header not found';
    }

    // If user authentication failed...
    if (message) {
        console.warn(message);

        // Return a response with a 401 Unauthorized HTTP status code.
        res.status(401).json({ message: 'Access Denied' });
    } else {
        // Call the next() method.
        next();
    }
};

// Get user
router.get('/users', authenticateUser, async (req, res) => {

    try {
        const user = await req.currentUser;

        res.json({
            name: user.firstName,
            username: user.lastName,
        });
    } catch (err) {
        console.log(err)
    }


})


// Validate user information and check email is email.
const userValidator = [
    check('firstName')
    .exists({ checkNull: true, checkFalsy: true })
    .withMessage("please put a firstName."),
    check('lastName')
    .exists({ checkNull: true, checkFalsy: true })
    .withMessage("please put a lastName."),
    check('emailAddress')
    .exists({ checkNull: true, checkFalsy: true })
    .withMessage("please put an email")
    .isEmail()
    .withMessage("Real email address"),
    check('password')
    .exists({ checkNull: true, checkFalsy: true })
    .withMessage("please put a password.")

]

// Create User
router.post('/users', userValidator, asyncHandler( async (req, res, next) => {

    const errors = validationResult(req);

    // If there are validation errors...
    if (!errors.isEmpty()) {
        // Use the Array `map()` method to get a list of error messages.
        const errorMessages = errors.array().map(error => error.msg);

        // Return the validation errors to the client.
        return res.status(400).json({ errors: errorMessages });
    }

        // Get the user from the request body.
        const user = req.body;

        // encrypt password plz
        user.password = bcryptjs.hashSync(user.password);

        await User.create(user);

        // Set the status to 201 Created and end the response.
        return res.status(201).json({ msg: "yay!" }).end();



}));

// GET /api/courses 200 - Returns a list of courses (including the user that owns each course)
router.get('/courses', async (req, res) => {

    const courses = await Course.findAll();
    res.json(courses);

})


// GET /api/courses/:id 200 - Returns the course (including the user that owns the course) for the provided course ID
router.get('/courses/:id', asyncHandler(async (req, res) => {

    const courseId = req.params.id;
    const course = await Course.findByPk(courseId);
    if (course) {
        res.status(200).json(course)

    } else {
        res.status(400).json({ message: "Course not found" })
    }


}));


// Validate Course information.
const courseValidator = [
    check('title')
    .exists({ checkNull: true, checkFalsy: true })
    .withMessage("please put a title."),
    check('description')
    .exists({ checkNull: true, checkFalsy: true })
    .withMessage("please put an Description")
]

// POST /api/courses 201 - Creates a course, sets the Location header to the URI for the course, and returns no content
// DOESNT WORK WITHOUT userId......
router.post('/courses', courseValidator, authenticateUser, asyncHandler(async (req, res, next) => {

    const errors = validationResult(req);
    let user = req.currentUser;
    console.log("Whatr?")
    // If there are validation errors...
    if (!errors.isEmpty()) {
        // Use the Array `map()` method to get a list of error messages.
        const errorMessages = errors.array().map(error => error.msg);
        // Return the validation errors to the client.
        console.log("Whatr22?")

        return res.status(400).json({ errors: errorMessages });
    } else {
        // Get the user from the request body.
        console.log("Whatr?333")

        let course = req.body;
        course.userId = user.id;

        course = await Course.create(course);

        // Set the status to 201 Created and end the response.
        return res.status(201).json({ msg: "Course created" }).end();
    }


}));

// PUT /api/courses/:id 204 - Updates a course and returns no content
// Update the course if the user id == userId
router.put('/courses/:id', courseValidator, authenticateUser, asyncHandler(async (req, res, next) => {

    const errors = validationResult(req);
    let user = req.currentUser;
    // If there are validation errors...
    if (!errors.isEmpty()) {
        // Use the Array `map()` method to get a list of error messages.
        const errorMessages = errors.array().map(error => error.msg);

        // Return the validation errors to the client.
        return res.status(400).json({ errors: errorMessages });
    } else {

        const course = await Course.findByPk(req.params.id);

        if (user.id === course.userId) {
            await course.update(req.body);
            res.status(204).json({ message: "updated" }).end();
        } else {
            return res.status(400).json({message: "This user cannot edit this course"}).end();
        }
    }


}));

// DELETE /api/courses/:id 204 - Deletes a course and returns no content
router.delete('/courses/:id', authenticateUser, asyncHandler(async (req, res, next) => {

    let user = req.currentUser;
    const courseId = req.params.id;

    const course = await Course.findByPk(courseId);

    if (user.id === course.userId) {
        await course.destroy();
        res.status(204).json({ message: "Course Deleted" }).end();
    } else {
        res.status(400).json({ message: "User doesnt have authority" }).end();
    }



}));

module.exports = router;