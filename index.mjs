import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import { authenticateToken } from './middleware/authenticateToken.mjs';
import { loginRoute, logoutRoute, chatRoute, webhookRoute, setupWebSocket, downloadRoute, adminRoute } from './routes/index.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = process.env.PORT || 5001;
export const JWT_SECRET_KEY = process.env.TOKEN_SECRET_KEY;

const app = express();

app.use(cors({
  origin: '*', // You might want to restrict this in production
  methods: ['GET', 'PUT', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Content-Length', 'X-Requested-With', 'Session-ID']
}));

app.use(bodyParser.urlencoded({ extended: true }))
  .use(bodyParser.json())
  .use(cookieParser())
  .use(express.json())
  .use(express.static(join(__dirname, 'public', 'assets')))
  .use('/login', express.static(join(__dirname, 'public', 'login')));

// Add root route redirect
app.get('/', (req, res) => {
  res.redirect('/chat');
});

// Add login route first, before any authentication
app.use(loginRoute);

// Add download route before authentication middleware
app.use(downloadRoute);

app.use('/files', express.static('/tmp'));

// Protected routes
app.use('/chat', authenticateToken)
  .use('/chat', express.static(join(__dirname, 'public', 'chat')))
  .use('/admin', authenticateToken)
  .use('/admin', express.static(join(__dirname, 'public', 'admin')));

  
// Other routes that need authentication
app.use(logoutRoute);
app.use(chatRoute);
app.use(webhookRoute);
app.use(adminRoute);

// Create HTTP server
const server = createServer(app);

// Setup WebSocket
setupWebSocket(server);

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  console.log(`WebSocket server ready at ws://localhost:${PORT}`);
});

// Handle process termination
process.on('SIGTERM', () => {
  server.close(() => {
    console.log('Server terminated');
    process.exit(0);
  });
});