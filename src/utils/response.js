const { generateResponse } = require("./utils.js");

function successResponse(res, data, message = null) {
    return res.status(200).json(generateResponse(true, message, data));
}

function errorResponse(res, message, status) {
    return res.status(status).json(generateResponse(false, message));
}

function validationErrorResponse(res, message) {
    return res.status(422).json(generateResponse(false, message));
}

function serverErrorResponse(res, message) {
    return res.status(500).json(generateResponse(false, message));
}

module.exports = {
    successResponse,
    errorResponse,
    validationErrorResponse,
    serverErrorResponse,
};
