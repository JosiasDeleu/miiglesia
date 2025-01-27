export function initializeWebSocket(sessionId, onData, onError, onClose) {
  const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
  const wsUrl = `${protocol}${window.location.host}`;
  const ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log('Connected to WebSocket server');
  };
  
  ws.onerror = onError;
  ws.onclose = onClose;
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'redirect') {
      window.location.href = data.url;
      return;
    }
    onData(data);
  };

  return ws;
}
