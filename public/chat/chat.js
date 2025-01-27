import { generateSessionId, replaceLinks } from './utils.js';
import { initializeWebSocket } from './websocket.js';

const md = window.markdownit({ breaks: true });
let currentMessageElement = null;
let accumulatedContent = '';
const sessionId = generateSessionId();
const domElements = {};
let ws;

document.addEventListener('DOMContentLoaded', () => {
    cacheElements();
    initializeEventListeners();
    initializeWebSocketConnection();
});

function cacheElements() {
    ['sendButton', 'userInput', 'chatBox', 'menuToggle', 'sidePanel', 'sidePanelLogout']
        .forEach(id => domElements[id] = document.getElementById(id));
}

function initializeEventListeners() {
    domElements.sendButton.addEventListener('click', sendMessage);
    domElements.userInput.addEventListener('keydown', e => e.key === 'Enter' && sendMessage());
    domElements.menuToggle.addEventListener('click', () => domElements.sidePanel.classList.toggle('visible'));
    domElements.sidePanelLogout.addEventListener('click', handleLogout);
    document.querySelector('header h1').addEventListener('click', () => window.location.reload());

    document.addEventListener('click', e => {
        if (window.innerWidth <= 768 && 
            !domElements.sidePanel.contains(e.target) && 
            !domElements.menuToggle.contains(e.target) &&
            domElements.sidePanel.classList.contains('visible')) {
            domElements.sidePanel.classList.remove('visible');
        }
    });

    replaceLinks(sendMessage);
}

function initializeWebSocketConnection() {
    ws = initializeWebSocket(
        sessionId,
        handleWebSocketMessage,
        error => console.error('WebSocket error:', error),
        () => console.warn('WebSocket connection closed')
    );
    return ws;
}

async function handleLogout(e) {
    e.preventDefault();
    try {
        const response = await fetch('/logout', { method: 'POST' });
        if (response.ok) {
            window.location.href = '/login';
        } else {
            alert(await response.text());
        }
    } catch (error) {
        console.error('Logout failed:', error);
        alert('Logout failed. Please try again.');
    }
}

function handleWebSocketMessage(data) {
    if (data.error) {
        if (currentMessageElement) {
            currentMessageElement.innerHTML = `Error: ${data.error}`;
            currentMessageElement = null;
        }
        return;
    }

    switch (data.type) {
        case 'stream':
            handleStreamMessage(data);
            break;
        case 'end':
            handleEndMessage();
            break;
    }
}

function handleStreamMessage(data) {
    if (!currentMessageElement) return;

    if (currentMessageElement.querySelector('.spinner')) {
        currentMessageElement.innerHTML = '';
    }

    if (data.content) {
        accumulatedContent += data.content.replace(/---/g, '').replace(/___/g, '\n');
        processAccumulatedContent();
    }
}

function processAccumulatedContent() {
    const fileMatch = accumulatedContent.match(/###(.*?)###/);
    if (fileMatch) {
        handleFileDownload(fileMatch[1].trim());
    }

    const parsedHTML = md.render(accumulatedContent);
    const processedContent = processContent(parsedHTML);
    
    if (currentMessageElement) {
        currentMessageElement.innerHTML = processedContent;
        replaceLinks(sendMessage);
    }
}

function formatNextAction(text) {
    return text.replace(/\$\$(.*?)\$\$(?:<br>)?/g, (match, phrase) => {
        return `<li class="nextAction">${phrase}</li>`;
    });
}

function processContent(html) {
    const withNextActions = formatNextAction(html);
    return withNextActions.replace(/<table.*?>.*?<\/table>/gs, match => 
        `<div class="table-container">${match}<li class="nextAction">Descargar esta tabla en Excel</li></div>`);
}

function handleFileDownload(fileName) {
    const baseUrl = window.location.origin;
    const downloadUrl = `${baseUrl}/download?file=${encodeURIComponent(fileName)}`;
    
    accumulatedContent = accumulatedContent.replace(/###(.*?)###/, `[Descargar reporte](${downloadUrl})`);

    const downloadLink = document.createElement('a');
    downloadLink.href = downloadUrl;
    downloadLink.download = fileName;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
}

function handleEndMessage() {
    accumulatedContent = '';
    currentMessageElement = null;
    domElements.sendButton.disabled = false;
}

async function sendMessage() {
    if (domElements.sendButton.disabled) return;

    const userInput = domElements.userInput.value.trim();
    if (!userInput) return;

    const welcomeMessage = document.getElementById('mensajeBienvenida');
    if (welcomeMessage) welcomeMessage.style.display = 'none';

    appendMessage('user', userInput);
    domElements.userInput.value = '';
    domElements.sendButton.disabled = true;

    currentMessageElement = appendMessage('server', '<span class="spinner"></span>');
    accumulatedContent = '';

    try {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ input: userInput, sessionId }));
        } else {
            throw new Error('WebSocket is not connected.');
        }
    } catch (error) {
        console.error(error);
        currentMessageElement.innerHTML = `Error: ${error.message}`;
        domElements.sendButton.disabled = false;
    }
}

function appendMessage(sender, message) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', sender === 'user' ? 'user' : 'server');
    messageElement.innerHTML = message;
    domElements.chatBox.appendChild(messageElement);
    domElements.chatBox.scrollTop = domElements.chatBox.scrollHeight;
    return messageElement;
}