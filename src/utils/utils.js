const getValidatorErrorMessage = (error) => {
  return error.details[0].message.replace(/\\/g, "").replace(/"/g, "");
};

const generateResponse = (status, message, data = null) => {
  return {
    status,
    message,
    data,
  };
};

const extractUserIdFromIdentity = (identity) => {
  if (identity && identity.startsWith("agent_")) {
    return identity.replace("agent_", "");
  }
  return null;
};

module.exports = {
  getValidatorErrorMessage,
  generateResponse,
  extractUserIdFromIdentity,
};
