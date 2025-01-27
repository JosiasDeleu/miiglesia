const activeSessions = new Map();

export function addSession(sessionId, username, userId, userRole) {
    // Check for existing session with same username
    for (const [existingSessionId, session] of activeSessions.entries()) {
        if (session.username === username) {
            activeSessions.delete(existingSessionId);
            break;
        }
    }

        // Add new session
        const newSession = {
            username,
            userId,
            userRole,
            createdAt: new Date()
        };
        activeSessions.set(sessionId, newSession);

}

export function removeSession(sessionId) {
    return activeSessions.delete(sessionId);
}

export function getSessionData(sessionId) {
    return activeSessions.get(sessionId) || null;
}

export function findSessionByUsername(username) {
    for (const [sessionId, session] of activeSessions.entries()) {
        if (session.username === username) {
            return { sessionId, ...session };
        }
    }
    return null;
}

export function clearAllSessions() {
    activeSessions.clear();
}

export function getActiveSessionsCount() {
    return activeSessions.size;
}

export function findSessionByUserId(userId) {
    for (const [sessionId, session] of activeSessions.entries()) {
        if (session.userId === userId) {
            return { sessionId, ...session };
        }
    }
    return null;
}
