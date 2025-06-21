const app = require("./app");
const colors = require('colors');

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(colors.cyan(`Server running on port ${PORT}`));
});