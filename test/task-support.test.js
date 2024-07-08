const chai = require('chai');
const chaiHttp = require('chai-http');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const app = require('../app'); // Import your express app
const User = require('../models/user');
const Class = require('../models/class');
const Task = require('../models/task');
const bcrypt = require('bcryptjs');

chai.use(chaiHttp);
const expect = chai.expect;

let mongoServer;

describe('Task Support System', function() {
    this.timeout(120000); // Increase timeout for async operations

    before(async () => {
        mongoServer = await MongoMemoryServer.create();
        const uri = mongoServer.getUri();

        await mongoose.disconnect(); // Ensure previous connections are closed
        await mongoose.connect(uri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        mongoose.connection.on('error', console.error.bind(console, 'MongoDB connection error:'));
    });

    after(async () => {
        await mongoose.disconnect();
        await mongoServer.stop();
    });

    beforeEach(async () => {
        await User.deleteMany({});
        await Class.deleteMany({});
        await Task.deleteMany({});

        // Seed initial data
        const teacher = new User({
            username: 'teacher1',
            password: bcrypt.hashSync('Teacher123!', 10), // Ensure password is hashed
            role: 'teacher'
        });
        await teacher.save();

        const student = new User({
            username: 'student1',
            password: bcrypt.hashSync('Student123!', 10), // Ensure password is hashed
            role: 'student'
        });
        await student.save();
    });

    describe('Register Teacher', () => {
        it('should register a new teacher', (done) => {
            chai.request(app)
                .post('/users/register')
                .send({
                    username: 'teacher2',
                    password: 'Teacher123!',
                    role: 'teacher',
                })
                .end((err, res) => {
                    if (err) return done(err);
                    expect(res).to.have.status(200);
                    done();
                });
        });
    });

    describe('Register Student', () => {
        it('should register a new student', (done) => {
            chai.request(app)
                .post('/users/register')
                .send({
                    username: 'student2',
                    password: 'Student123!',
                    role: 'student',
                })
                .end((err, res) => {
                    if (err) return done(err);
                    expect(res).to.have.status(200);
                    done();
                });
        });
    });

    describe('Login Teacher', () => {
        it('should log in the teacher', (done) => {
            chai.request(app)
                .post('/users/login')
                .send({
                    username: 'teacher1',
                    password: 'Teacher123!',
                })
                .end((err, res) => {
                    if (err) return done(err);
                    expect(res).to.have.status(200);
                    done();
                });
        });
    });

    describe('Login Student', () => {
        it('should log in the student', (done) => {
            chai.request(app)
                .post('/users/login')
                .send({
                    username: 'student1',
                    password: 'Student123!',
                })
                .end((err, res) => {
                    if (err) return done(err);
                    expect(res).to.have.status(200);
                    done();
                });
        });
    });

   
    // Continue with other tests following the same pattern

});
