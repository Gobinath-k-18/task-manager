require("dotenv").config();

const app = require("./src/app");

const port = process.env.PORT || 5000;

app.listen(port, () => {
  console.log(`Task Manager API listening on port ${port}`);
});