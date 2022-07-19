'use strict';
import $ from 'jquery';
globalThis.jQuery = $;
import bootstrap from 'bootstrap';

$('.availability-toggle-button').each((i, e) => {
  const button = $(e);
  button.on('click', () => {
    const scheduleId = button.data('schedule-id');
    const userId = button.data('user-id');
    const candidateId = button.data('candidate-id');
    const availability = parseInt(button.data('availability'));
    const nextAvailability = (availability + 1) % 3;
    $.post(
      `/schedules/${scheduleId}/users/${userId}/candidates/${candidateId}`,
      { availability: nextAvailability },
      (data) => {
        button.data('availability', data.availability);
        const availabilityLabels = ['Absent', '?', 'Present'];
        button.text(availabilityLabels[data.availability]);
      }
    );
  });
})

const buttonSelfComment = $('#self-comment-button');
buttonSelfComment.on('click', () => {
  const scheduleId = buttonSelfComment.data('schedule-id');
  const userId = buttonSelfComment.data('user-id');
  const comment = prompt('Please enter comment within 255 chars.');
  if (comment) {
    $.post(
      `/schedules/${scheduleId}/users/${userId}/comments`,
      { comment: comment },
      (data) => {
        $('#self-comment').text(data.comment);
      }
    );
  }
});