'use strict';
const request = require('supertest');
const app = require('../app');
const passportStub = require('passport-stub');
const User = require('../models/user');
const Schedule = require('../models/schedule');
const Candidate = require('../models/candidate');
const Availability = require('../models/availability');
const Comment = require('../models/comment');
const deleteScheduleAggregate = require('../routes/schedules').deleteScheduleAggregate;

describe('/login', () => {
  beforeAll(() => {
    passportStub.install(app);
    passportStub.login({ username: 'testuser' });
  });

  afterAll(() => {
    passportStub.logout();
    passportStub.uninstall();
  });

  test('contain link for login', async () => {
    await request(app)
      .get('/login')
      .expect('Content-Type', 'text/html; charset=utf-8')
      .expect(/<a href="\/auth\/github"/)
      .expect(200);
  });

  test('display username when logged in', async () => {
    await request(app)
      .get('/login')
      .expect(/testuser/)
      .expect(200);
  });
});

describe('/logout', () => {
  test('redirect to "/"', async () => {
    await request(app)
      .get('/logout')
      .expect('Location', '/')
      .expect(302);
  });
});

describe('/schedules', () => {
  let scheduleId = '';
  beforeAll(() => {
    passportStub.install(app);
    passportStub.login({ id: 0, username: 'testuser' });
  });

  afterAll(async () => {
    passportStub.logout();
    passportStub.uninstall();

    await deleteScheduleAggregate(scheduleId);
  });

  test('create and display schedule', async () => {
    await User.upsert({ userId: 0, username: 'testuser' });
    const res = await request(app)
      .post('/schedules')
      .send({
        scheduleName: 'test schedule 1',
        memo: 'test memo1\r\ntest memo2',
        candidates: 'test can1\r\ntest can2'
      })
      .expect('Location', /schedules/)
      .expect(302);

    const createdSchedulePath = res.headers.location;
    scheduleId = createdSchedulePath.split('/schedules/')[1];
    await request(app)
      .get(createdSchedulePath)
      .expect(/test schedule 1/)
      .expect(/test memo1/)
      .expect(/test memo2/)
      .expect(/test can1/)
      .expect(/test can2/)
      .expect(200);
  });
});

describe('/schedules/:scheduleId/users/:userId/candidates/:candidateId', () => {
  let scheduleId = '';
  beforeAll(() => {
    passportStub.install(app);
    passportStub.login({ id: 0, username: 'testuser' });
  });

  afterAll(async () => {
    passportStub.logout();
    passportStub.uninstall();
    await deleteScheduleAggregate(scheduleId);
  });

  test('update availabilities', async() => {
    await User.upsert({ userId: 0, username: 'testuser'});
    const res = await request(app)
      .post('/schedules')
      .send({ scheduleName: 'test schedule 1', candidates: 'can1'});
    const createdSchedulePath = res.headers.location;
    scheduleId = createdSchedulePath.split('/schedules/')[1];
    const candidate = await Candidate.findOne({
      where: { scheduleId: scheduleId }
    });

    const userId = 0;
    await request(app)
      .post(`/schedules/${scheduleId}/users/${userId}/candidates/${candidate.candidateId}`)
      .send({ availability: 2}) // 2 => present
      .expect('{"status":"OK","availability":2}');

    // test if the updated availabilities are reflected onto database
    const { availability } = await Availability.findOne({
      where: { scheduleId: scheduleId }
    });
    expect(availability).toBe(2);
  });
});

describe('/schedules/:scheduleId/users/:userId/comments', () => {
  let scheduleId = '';

  beforeAll(() => {
    passportStub.install(app);
    passportStub.login({ id: 0, username: 'testuser' });
  });

  afterAll(async () => {
    passportStub.logout();
    passportStub.uninstall();
    await deleteScheduleAggregate(scheduleId);
  });

  test('update comments', async () => {
    await User.upsert({ userId: 0, username: 'testuser'});
    const res = await request(app)
      .post('/schedules')
      .send({
        scheduleName: 'test comment schedule 1',
        candidates: 'test comment can 1'
      });
    const createdSchedulePath = res.headers.location;
    scheduleId = createdSchedulePath.split('/schedules/')[1];

    const userId = 0;
    await request(app)
      .post(`/schedules/${scheduleId}/users/${userId}/comments`)
      .send({ comment: 'testcomment' })
      .expect('{"status":"OK","comment":"testcomment"}');
    const { comment } = await Comment.findOne({
      where: { scheduleId: scheduleId }
    });
    expect(comment).toBe('testcomment');
  });
});

describe('/schedules/:scheduleId?edit=1', () => {
  let scheduleId = '';
  
  beforeAll(() => {
    passportStub.install(app);
    passportStub.login({ id: 0, username: 'testuser' });
  });

  afterAll(async () => {
    passportStub.logout();
    passportStub.uninstall();
    await deleteScheduleAggregate(scheduleId);
  });

  test('update schedule and add candidates', async () => {
    await User.upsert({ userId: 0, username: 'testuser' });
    const res = await request(app)
      .post('/schedules')
      .send({ scheduleName: 'test schedule', memo: 'test memo', candidates: 'can1'});
    const createdSchedulePath = res.headers.location;
    scheduleId = createdSchedulePath.split('/schedules/')[1];

    // test if update succeeds
    await request(app)
      .post(`/schedules/${scheduleId}?edit=1`)
      .send({ scheduleName: 'updated schedule', memo: 'updated memo', candidates: 'can2'});
    const schedule = await Schedule.findByPk(scheduleId);
    expect(schedule.scheduleName).toBe('updated schedule');
    expect(schedule.memo).toBe('updated memo');
    const candidates = await Candidate.findAll({
      where: { scheduleId: scheduleId },
      order: [[ 'candidateId', 'ASC' ]]
    });
    expect(candidates.length).toBe(2);
    expect(candidates[0].candidateName).toBe('can1');
    expect(candidates[1].candidateName).toBe('can2');
  });
});

describe('/schedules/:scheduleId?delete=1', () => {
  beforeAll(() => {
    passportStub.install(app);
    passportStub.login({ id: 0, username: 'testuser' });
  });

  afterAll(() => {
    passportStub.logout();
    passportStub.uninstall();
  });

  test('delete all info of the given schedule', async () => {
    await User.upsert({ userId: 0, username: 'testuser' });
    const res = await request(app)
      .post('/schedules')
      .send({ scheduleName: 'test schedule', candidates: 'can1' });
    const createdSchedulePath = res.headers.location;
    const scheduleId = createdSchedulePath.split('/schedules/')[1];

    // create availability
    const candidate = await Candidate.findOne({
      where: { scheduleId: scheduleId }
    });
    await request(app)
      .post(`/schedules/${scheduleId}/users/${0}/candidates/${candidate.candidateId}`)
      .send({ availability: 2 });

    // create comment
    await request(app)
      .post(`/schedules/${scheduleId}/users/${0}/comments`)
      .send({ comment: 'test comment' })
      .expect('{"status":"OK","comment":"test comment"}');

    // delete
    await request(app)
      .post(`/schedules/${scheduleId}?delete=1`);

    // test
    const comments = await Comment.findAll({
      where: { scheduleId: scheduleId }
    });
    expect(comments.length).toBe(0);

    const availabilities = await Availability.findAll({
      where: { scheduleId: scheduleId }
    });
    expect(availabilities.length).toBe(0);

    const candidates = await Candidate.findAll({
      where: { scheduleId: scheduleId }
    });
    expect(candidates.length).toBe(0);

    const schedule = await Schedule.findByPk(scheduleId);
    expect(!schedule).toBe(true);
  });
});
