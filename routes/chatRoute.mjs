import { Router } from 'express';
import { WebSocketServer } from 'ws';
import path from 'path';
import { streamSupervisor } from '../lang_chain/streamer.js';
import jwt from 'jsonwebtoken';
import { JWT_SECRET_KEY } from '#root';
import { addSession } from '../utils/activeSessionsData.js';

const router = Router();
const __dirname = path.resolve();

router.get('/chat', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'chat', 'chat.html'));
});

export const setupWebSocket = (server) => {
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws, req) => {
    console.log('New WebSocket connection attempt');
    let sessionId;

    // Get token from cookie instead of URL params
    const cookies = req.headers.cookie?.split(';')
      .reduce((acc, cookie) => {
        const [key, value] = cookie.trim().split('=');
        acc[key] = value;
        return acc;
      }, {});

    if (!cookies?.accessToken) {
      ws.send(JSON.stringify({ type: 'redirect', url: '/login' }));
      ws.close();
      return;
    }

    try {
      const decoded = jwt.verify(cookies.accessToken, JWT_SECRET_KEY);
      let sessionInitialized = false;

      // Set up message handler only after successful authentication
      ws.on('message', async (message) => {
        try {
          const data = JSON.parse(message);
          
          // Initialize session on first message
          if (!sessionInitialized) {
            sessionId = data.sessionId;
            if (!sessionId) {
              ws.send(JSON.stringify({ error: 'Session ID is required' }));
              return;
            }
            addSession(sessionId, decoded.username, decoded.id, decoded.rol);
            sessionInitialized = true;
          }

          // Validate message structure
          if (!data.input || typeof data.input !== 'string') {
            ws.send(JSON.stringify({ 
              type: 'error', 
              error: 'Invalid message format: input is required and must be a string' 
            }));
            return;
          }

          const generator = await streamSupervisor(data.input, sessionId);
          const startTimestamp = Date.now();
          let firstChunkSent = false;

          for await (const output of generator) {
            if (!firstChunkSent) {
              firstChunkSent = true;
              console.log(`Time to start sending response: ${Date.now() - startTimestamp}ms`);
            }
            ws.send(JSON.stringify({
              type: 'stream',
              content: output
            }));
          }

          ws.send(JSON.stringify({
            type: 'end'
          }));
          console.log(`Time to complete full response: ${Date.now() - startTimestamp}ms`);
        } catch (error) {
          console.error('WebSocket error:', error);
          ws.send(JSON.stringify({
            type: 'error',
            error: 'Failed to process the message'
          }));
        }
      });
    } catch (error) {
      ws.send(JSON.stringify({ type: 'redirect', url: '/login' }));
      ws.close();
    }
  });
};

export { router as chatRoute };
