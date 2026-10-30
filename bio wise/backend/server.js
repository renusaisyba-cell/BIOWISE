require('dotenv').config();
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const api = require('./routes/api');
const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '100kb' }));
app.use('/api', api);
app.use(express.static(path.join(__dirname, '..', 'frontend')));
app.get('/{*path}', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});
app.use((err, _req, res, _next) => {
  console.error(err.message);
  res.status(500).json({ success: false, error: 'Unexpected server error.' });
});
app.listen(PORT, () => console.log(`Bio Wise is running at http://localhost:${PORT}`));
