// ──────────────────────────────────────────
// Chat persistence — Supabase CRUD for conversations & messages
// ──────────────────────────────────────────
import { supabase } from './supabase';

/**
 * Create a new conversation.
 */
export async function createConversation(userId, namespace, title = 'New Chat') {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('conversations')
    .insert({ user_id: userId, namespace, title })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Fetch all conversations for a user, sorted by most recent.
 */
export async function fetchConversations(userId) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('conversations')
    .select('id, title, namespace, created_at, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

/**
 * Fetch messages for a conversation.
 */
export async function fetchMessages(conversationId) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

/**
 * Save a message to a conversation.
 */
export async function saveMessage(conversationId, msg) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      role: msg.role,
      content: msg.content,
      sources: msg.sources || [],
      enhanced_query: msg.enhancedQuery || null,
      smart_info: msg.smartInfo || null,
      run_id: msg.runId || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Update conversation title.
 */
export async function updateConversationTitle(conversationId, title) {
  if (!supabase) return;
  const { error } = await supabase
    .from('conversations')
    .update({ title, updated_at: new Date().toISOString() })
    .eq('id', conversationId);
  if (error) throw error;
}

/**
 * Delete a conversation (messages cascade-deleted).
 */
export async function deleteConversation(conversationId) {
  if (!supabase) return;
  const { error } = await supabase
    .from('conversations')
    .delete()
    .eq('id', conversationId);
  if (error) throw error;
}
