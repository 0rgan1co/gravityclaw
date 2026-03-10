/**
 * Estado de Talk Mode por usuario.
 * Cuando está activo, todas las respuestas se envían también como audio (ElevenLabs TTS).
 */
const talkModeUsers = new Set<number>();

export const isTalkModeOn = (userId: number): boolean => {
    return talkModeUsers.has(userId);
};

export const toggleTalkMode = (userId: number): boolean => {
    if (talkModeUsers.has(userId)) {
        talkModeUsers.delete(userId);
        return false; // Talk mode OFF
    }
    talkModeUsers.add(userId);
    return true; // Talk mode ON
};
