const { generateResponse } = require("../utils/utils.js");

const successResponse = (res, data, message = null) => {
    return res.status(200).json(generateResponse(true, message, data));
};

const errorResponse = (res, message, status) => {
    return res.status(status).json(generateResponse(false, message));
};

const validationErrorResponse = (res, message) => {
    return res.status(422).json(generateResponse(false, message));
};

const serverErrorResponse = (res, message) => {
    return res.status(500).json(generateResponse(false, message));
};

module.exports = {
    successResponse,
    errorResponse,
    validationErrorResponse,
    serverErrorResponse,
};