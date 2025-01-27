export function generateSessionId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export function replaceLinks(sendMessage) {
    const links = document.querySelectorAll('.nextAction');
    links.forEach(link => {
        link.style.cursor = 'pointer';
        link.addEventListener('click', () => {
            const userInputElement = document.getElementById('userInput');
            if (!userInputElement) {
                console.error('User input element not found');
                return;
            }
            
            userInputElement.value = link.textContent;
            sendMessage();
        });
    });
}
