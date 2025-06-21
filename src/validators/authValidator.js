const { body } = require('express-validator');

exports.signupValidator = [
  body('name').notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
];

exports.loginValidator = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

exports.changePasswordValidator = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('oldPassword').notEmpty().withMessage('Old password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
];

exports.forgotPasswordValidator = [
  body('email').isEmail().withMessage('Valid email is required'),
];

exports.resetPasswordValidator = [
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
];
