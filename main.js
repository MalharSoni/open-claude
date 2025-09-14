console.log('🚨 MAIN.JS RUNNING - THIS SHOULD BE UNIFIED-SERVER');
console.log('Files in directory:', require('fs').readdirSync('.'));

const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.json({
    error: 'WRONG FILE RUNNING',
    message: 'main.js is running instead of unified-server.js',
    fix: 'Check render.yaml or Render dashboard settings'
  });
});

app.listen(port, () => {
  console.log(`🚨 Wrong server running on port ${port}`);
});