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

router.get('/new', authenticationEnsurer, (req, res, next) => {
  res.render('new', { user: req.user });
});

router.post('/', authenticationEnsurer, async (req, res, next) => {
  const scheduleId = uuidv4();
  const updatedAt = new Date();
  const schedule = await Schedule.create({
    scheduleId: scheduleId,
    scheduleName: req.body.scheduleName.slice(0, 255) || '(undefined)',
    memo: req.body.memo,
    createdBy: req.user.id,
    updatedAt: updatedAt
  });
  const candidateNames = req.body.candidates.trim().split('\n').map(s => s.trim()).filter(s => s !== "");
  const candidates = candidateNames.map(c => {
    return {
      candidateName: c,
      scheduleId: schedule.scheduleId
    }
  });
  await Candidate.bulkCreate(candidates);
  
  res.redirect('/schedules/' + schedule.scheduleId);
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
    const err = new Error('404 Not Found');
    err.status = 404;
    next(err);
  }
});

module.exports =  router;
