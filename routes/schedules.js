'use strict';
const express = require('express');
const router = express.Router();
const authenticationEnsurer = require('./authentication-ensurer');
const { v4: uuidv4 } = require('uuid');
const Schedule = require('../models/schedule');
const Candidate = require('../models/candidate');
const User = require('../models/user');
const Availability = require('../models/availability');
const Comment = require('../models/comment');
const csrf = require('csurf');
const csrfProtection = csrf({ cookie: true });

router.get('/new', authenticationEnsurer, csrfProtection, (req, res, next) => {
  res.render('new', { user: req.user, csrfToken: req.csrfToken() });
});

router.post('/', authenticationEnsurer, csrfProtection, async (req, res, next) => {
  const scheduleId = uuidv4();
  const updatedAt = new Date();
  await Schedule.create({
    scheduleId: scheduleId,
    scheduleName: req.body.scheduleName.slice(0, 255) || '(undefined)',
    memo: req.body.memo,
    createdBy: req.user.id,
    updatedAt: updatedAt
  });
  createCandidatesAndRedirect(parseCandidateNames(req), scheduleId, res);
});

router.get('/:scheduleId', authenticationEnsurer, async (req, res, next) => {
  const schedule = await Schedule.findOne({
    include: [
      {
        model: User,
        attributes: ['userId', 'username']
      }
    ],
    where: {
      scheduleId: req.params.scheduleId
    },
    order: [[ 'updatedAt', 'DESC']]
  });
  if (schedule) {
    const candidates = await Candidate.findAll({
      where: { scheduleId: schedule.scheduleId },
      order: [[ 'candidateId', 'ASC' ]]
    });

    // fetch all availabilities of the given schedule from the database
    const availabilities = await Availability.findAll({
      include: [
        {
          model: User,
          attributes: ['userId', 'username']
        }
      ],
      where: { scheduleId: schedule.scheduleId },
      order: [[ User, 'username', 'ASC' ], [ 'candidateId', 'ASC' ]]
    });

    // create MapMap(key: userId, value: availability Map(key: candidateId, value: availability))
    const availabilityMapMap = new Map();
    availabilities.forEach(a => {
      const map = availabilityMapMap.get(a.user.userId) || new Map();
      map.set(a.candidateId, a.availability);
      availabilityMapMap.set(a.user.userId, map);
    });

    // create userMap (key: userId, value: User)
    const userMap = new Map();
    
    // add viewing user themselves to userMap
    userMap.set(parseInt(req.user.id), {
      isSelf: true,
      userId: parseInt(req.user.id),
      username: req.user.username
    });

    availabilities.forEach(a => {
      userMap.set(a.user.userId, {
        isSelf: parseInt(req.user.id) === a.user.userId, 
        userId: a.user.userId,
        username: a.user.username
      });
    });

    const users = Array.from(userMap).map(keyValue => keyValue[1]);
    users.forEach(user => {
      candidates.forEach(candidate => {
        const availabilityMap =  availabilityMapMap.get(user.userId) || new Map();
        const availability = availabilityMap.get(candidate.candidateId) || 0;
        availabilityMap.set(candidate.candidateId, availability)
        availabilityMapMap.set(user.userId, availabilityMap)
      });
    });

    // fetching comment
    const comments = await Comment.findAll({
      where: { scheduleId: schedule.scheduleId }
    });
    const commentMap = new Map(); // key: userId, value: comment
    comments.forEach(comment => {
      commentMap.set(comment.userId, comment.comment)
    });

    res.render('schedule', {
      user: req.user,
      schedule: schedule,
      candidates: candidates,
      users: users,
      availabilityMapMap: availabilityMapMap,
      commentMap: commentMap
    });
  } else {
    const err = new Error('Schedule Not Found');
    err.status = 404;
    next(err);
  }
});

router.get('/:scheduleId/edit', authenticationEnsurer, csrfProtection, async (req, res, next) => {
  const schedule = await Schedule.findOne({
    where: { scheduleId: req.params.scheduleId }
  });
  if (isMine(req, schedule)) {
    const candidates = await Candidate.findAll({
      where: { scheduleId: schedule.scheduleId },
      order: [[ 'candidateId', 'ASC' ]]
    });
    res.render('edit', {
      user: req.user,
      schedule: schedule,
      candidates: candidates,
      csrfToken: req.csrfToken()
    });
  } else {
    const err = new Error('Schedule Not Found or Not Authorized')
    err.status = 404;
    next(err);
  }
});

function isMine(req, schedule) {
  return schedule && parseInt(schedule.createdBy) === parseInt(req.user.id);
}

router.post('/:scheduleId', authenticationEnsurer, csrfProtection, async (req, res, next) => {
  let schedule = await Schedule.findOne({
    where: {
      scheduleId: req.params.scheduleId
    }
  });
  if (schedule && isMine(req, schedule)) {
    if (parseInt(req.query.edit) === 1) {
      const updatedAt = new Date();
      schedule = await schedule.update({
        scheduleId: schedule.scheduleId,
        scheduleName: req.body.scheduleName.slice(0, 255) || '(undefined)',
        memo: req.body.memo,
        createdBy: req.user.id,
        updatedAt: updatedAt
      });

      // check if candidate is added
      const candidateNames = parseCandidateNames(req);
      if (candidateNames) {
        createCandidatesAndRedirect(candidateNames, schedule.scheduleId, res);
      } else {
        res.redirect('/schedules/' + schedule.scheduleId);
      }
    } else if (parseInt(req.query.delete) === 1) {
      await deleteScheduleAggregate(req.params.scheduleId);
      res.redirect('/');
    } else {
      const err = new Error('Bad request.');
      err.status = 400;
      next(err);
    }
  } else {
    const err = new Error('Schedule Not Found or Not Authorized');
    err.status = 404;
    next(err);
  }
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

router.deleteScheduleAggregate = deleteScheduleAggregate;

async function createCandidatesAndRedirect(candidateNames, scheduleId, res) {
  const candidates = candidateNames.map(c => {
    return {
      candidateName: c,
      scheduleId: scheduleId
    }
  });
  await Candidate.bulkCreate(candidates);
  res.redirect('/schedules/' + scheduleId);
}

function parseCandidateNames(req) {
  return req.body.candidates.trim()
    .split('\n').map(schedule => schedule.trim())
    .filter(schedule => schedule !== "");
}

module.exports =  router;
