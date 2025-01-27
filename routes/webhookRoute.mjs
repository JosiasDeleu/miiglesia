import { Router } from 'express';
import { webhook_post } from '../whatsapp/webhook_post.js';

const router = Router();

router.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.WEBHOOK_VERIFY_TOKEN) {
    res.status(200).send(challenge);
    console.log("Webhook verified successfully!");
  } else {
    res.sendStatus(403);
  }
});

router.post("/webhook", async (req, res) => {
  await webhook_post(req);
  res.sendStatus(200);
});

export { router as webhookRoute };
