import { config } from '../config.js';
import admin from 'firebase-admin';
import Database from 'better-sqlite3';

const localDb = new Database(config.DB_PATH);

// Inicializar tablas locales si no existen (ideal para cuando se despliega en Railway desde cero)
localDb.exec(`
    CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        role TEXT NOT NULL,
        content TEXT,
        tool_calls TEXT,
        tool_call_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS memories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        conversation_id TEXT,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        metadata_json TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_settings (
        user_id INTEGER PRIMARY KEY,
        provider_id TEXT NOT NULL DEFAULT 'openrouter',
        model_id TEXT NOT NULL DEFAULT 'anthropic/claude-3-haiku',
        think_level TEXT NOT NULL DEFAULT 'off'
    );
`);

// Inicializa Firebase Admin SDK
if (!admin.apps.length) {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
        // En producción / Railway: leer desde variable Base64
        const certString = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf-8');
        admin.initializeApp({
            credential: admin.credential.cert(JSON.parse(certString))
        });
    } else {
        // En local: Firebase usa automáticamente la variable de entorno GOOGLE_APPLICATION_CREDENTIALS
        admin.initializeApp();
    }
}

const db = admin.firestore();

// Define the role type to match Groq/OpenAI structures
export type Role = 'system' | 'user' | 'assistant' | 'tool';

export interface Message {
    id: number;
    user_id: number;
    role: Role;
    content: string;
    created_at: string;
}

export interface ToolCallMessage {
    id: number;
    user_id: number;
    role: 'assistant';
    content: string | null;
    tool_calls: string; // JSON string
    created_at: string;
}

export interface ToolResponseMessage {
    id: number;
    user_id: number;
    role: 'tool';
    content: string;
    tool_call_id: string;
    created_at: string;
}

/**
 * Agrega un mensaje estándar a la base de datos de Firestore y a la base local SQLite.
 */
export const addMessage = async (userId: number, role: Role, content: string) => {
    // 1. Guardar en SQLite (Local)
    const stmt = localDb.prepare(`
        INSERT INTO messages (user_id, role, content)
        VALUES (?, ?, ?)
    `);
    stmt.run(userId, role, content);

    // 2. Sincronizar con Firestore (Nube)
    const messagesRef = db.collection('messages');
    await messagesRef.add({
        user_id: userId,
        role: role,
        content: content,
        tool_calls: null,
        tool_call_id: null,
        created_at: admin.firestore.FieldValue.serverTimestamp()
    });
};

/**
 * Agrega un mensaje que contiene llamadas a herramientas (cuando el agente decide usar una tool).
 */
export const addToolCallMessage = async (userId: number, toolCalls: any[], content: string | null = null) => {
    const toolCallsString = JSON.stringify(toolCalls);

    // 1. Guardar en SQLite (Local)
    const stmt = localDb.prepare(`
        INSERT INTO messages (user_id, role, content, tool_calls)
        VALUES (?, ?, ?, ?)
    `);
    stmt.run(userId, 'assistant', content, toolCallsString);

    // 2. Sincronizar con Firestore (Nube)
    const messagesRef = db.collection('messages');
    await messagesRef.add({
        user_id: userId,
        role: 'assistant',
        content: content,
        tool_calls: toolCallsString,
        tool_call_id: null,
        created_at: admin.firestore.FieldValue.serverTimestamp()
    });
};

/**
 * Agrega la respuesta de una herramienta ejecutada.
 */
export const addToolResponseMessage = async (userId: number, toolCallId: string, content: string) => {
    // 1. Guardar en SQLite (Local)
    const stmt = localDb.prepare(`
        INSERT INTO messages (user_id, role, content, tool_call_id)
        VALUES (?, ?, ?, ?)
    `);
    stmt.run(userId, 'tool', content, toolCallId);

    // 2. Sincronizar con Firestore (Nube)
    const messagesRef = db.collection('messages');
    await messagesRef.add({
        user_id: userId,
        role: 'tool',
        content: content,
        tool_calls: null,
        tool_call_id: toolCallId,
        created_at: admin.firestore.FieldValue.serverTimestamp()
    });
};


/**
 * Obtiene el historial reciente de mensajes de un usuario específico.
 */
export const getMessageHistory = async (userId: number, limit: number = 20) => {
    const messagesRef = db.collection('messages');

    // Obtenemos los últimos mensajes (orden descendente)
    const snapshot = await messagesRef
        .where('user_id', '==', userId)
        .orderBy('created_at', 'desc')
        .limit(limit)
        .get();

    if (snapshot.empty) {
        return [];
    }

    // Invertimos la lista recuperada para devolverla en orden cronológico ascendente (el formato esperado por el LLM)
    const docs = snapshot.docs.map(doc => doc.data()).reverse();

    return docs.map(row => {
        const msg: any = { role: row.role };
        if (row.content !== null && row.content !== undefined) msg.content = row.content;
        if (row.tool_calls) msg.tool_calls = JSON.parse(row.tool_calls);
        if (row.tool_call_id) msg.tool_call_id = row.tool_call_id;
        return msg;
    });
};

/**
 * Borra el historial de un usuario.
 */
export const clearUserHistory = async (userId: number) => {
    const messagesRef = db.collection('messages');
    // Para borrar en montón (batch) es necesario obtener los documentos a borrar primero
    const snapshot = await messagesRef.where('user_id', '==', userId).get();

    if (snapshot.empty) return;

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
    });

    await batch.commit();
};

// --- LOGIC FOR MEMORY (Long Term Context) via Local SQLite ---

export interface Memory {
    id: number;
    user_id: number;
    conversation_id?: string;
    timestamp: string;
    type: string;
    content: string;
    metadata_json?: string;
}

/**
 * Guarda una nueva memoria en la base de datos local
 */
export const saveMemory = (userId: number, type: string, content: string, conversationId?: string, metadata?: any) => {
    const stmt = localDb.prepare(`
        INSERT INTO memories (user_id, conversation_id, type, content, metadata_json)
        VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(userId, conversationId || null, type, content, metadata ? JSON.stringify(metadata) : null);
};

/**
 * Obtiene memorias relevantes. Por el momento es una búsqueda básica por fecha de creación (latest first).
 * Podría extenderse fácilmente con búsqueda semántica / embeddings.
 */
export const getRelevantMemories = (userId: number, limit: number = 5): Memory[] => {
    const stmt = localDb.prepare(`
        SELECT * FROM memories WHERE user_id = ? ORDER BY timestamp DESC LIMIT ?
    `);
    return stmt.all(userId, limit) as Memory[];
};

/**
 * Borra una memoria concreta por su ID
 */
export const deleteMemory = (memoryId: number) => {
    const stmt = localDb.prepare('DELETE FROM memories WHERE id = ?');
    stmt.run(memoryId);
};

// --- USER SETTINGS ---

export interface UserSettings {
    user_id: number;
    provider_id: string;
    model_id: string;
    think_level: 'off' | 'low' | 'medium' | 'high';
}

export const getUserSettings = (userId: number): UserSettings => {
    const stmt = localDb.prepare('SELECT * FROM user_settings WHERE user_id = ?');
    const settings = stmt.get(userId) as UserSettings | undefined;
    if (settings) return settings;

    // Default settings
    return {
        user_id: userId,
        provider_id: 'openrouter',
        model_id: 'anthropic/claude-3-haiku',
        think_level: 'off'
    };
};

export const updateUserSettings = (userId: number, updates: Partial<UserSettings>) => {
    const current = getUserSettings(userId);
    const updated = { ...current, ...updates, user_id: userId };
    
    const stmt = localDb.prepare(`
        INSERT OR REPLACE INTO user_settings (user_id, provider_id, model_id, think_level)
        VALUES (?, ?, ?, ?)
    `);
    stmt.run(updated.user_id, updated.provider_id, updated.model_id, updated.think_level);
};
