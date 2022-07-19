'use strict';
const request = require('supertest');
const app = require('../app');
const passportStub = require('passport-stub');
const User = require('../models/user');
const Schedule = require('../models/schedule');
const Candidate = require('../models/candidate');
const Availability = require('../models/availability');
const Comment = require('../models/comment');

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


async function deleteScheduleAggregate(scheduleId) {
  // Delete test comments
  const comments = await Comment.findAll({
    where: { scheduleId: scheduleId }
  });
  const promiseCommentDestroy = comments.map(comment => {
    return comment.destroy();
  });
  
  await Promise.all(promiseCommentDestroy);
  
  // Delete test availabilities
  const availabilities = await Availability.findAll({
    where: { scheduleId: scheduleId }
  });

  const promiseAvailabilityDestroy = availabilities.map(availability => {
    return availability.destroy();
  });

  await Promise.all(promiseAvailabilityDestroy);
  
  // Delete test candidates
  const candidates = await Candidate.findAll({
    where: { scheduleId: scheduleId }
  });
  const promiseCandidateDestroy = candidates.map(candidate => {
    return candidate.destroy();
  });

  await Promise.all(promiseCandidateDestroy);

  const schedule = await Schedule.findByPk(scheduleId);
  await schedule.destroy();
}
