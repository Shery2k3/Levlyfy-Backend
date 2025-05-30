module.exports = (err, req, res, next) => {
    console.log("Error Middleware", err);
  
    res.status(500).json({
      success: false,
      message: "Something went wrong",
      data: {
        status: err?.status,
        message: err?.message,
        name: err?.name,
        stack: err?.stack,
      },
    });
  };
  
  
  
  