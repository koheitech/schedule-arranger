'use strict';
const express = require('express');
const router = express.Router();
const authenticationEnsurer = require('./authentication-ensurer');
const { v4: uuidv4 } = require('uuid');
const Schedule = require('../models/schedule');
const Candidate = require('../models/candidate');

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

module.exports =  router;
