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
  
  module.exports = {
    getValidatorErrorMessage,
    generateResponse,
  };
  