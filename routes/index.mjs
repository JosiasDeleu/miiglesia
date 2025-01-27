import { Router } from 'express';
import { loginRoute } from './loginRoute.mjs';
import { logoutRoute } from './logoutRoute.mjs';
import { chatRoute, setupWebSocket } from './chatRoute.mjs';
import { webhookRoute } from './webhookRoute.mjs';
import { downloadRoute } from './downloadRoute.mjs';
import { adminRoute } from './adminRoute.mjs';

const router = Router();

router.use(loginRoute);
router.use(logoutRoute);
router.use(chatRoute);
router.use(webhookRoute);
router.use(downloadRoute);
router.use(adminRoute);

export { 
    loginRoute, 
    logoutRoute, 
    chatRoute, 
    webhookRoute,
    downloadRoute,
    adminRoute,
    setupWebSocket
};
