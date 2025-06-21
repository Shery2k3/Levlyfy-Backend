const { body, param } = require('express-validator');

exports.uploadCallValidator = [
  body('userId').notEmpty().withMessage('User ID is required'),
  // You can add more validations for file, callNotes, etc. if needed
];

exports.reanalyzeCallValidator = [
  param('id').isMongoId().withMessage('Valid call ID is required'),
];

exports.downloadDecryptedAudioValidator = [
  param('id').isMongoId().withMessage('Valid call ID is required'),
];
