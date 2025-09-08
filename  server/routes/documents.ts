import { Router } from 'express';
import { SupabaseClient } from '@supabase/supabase-js';

export function documentRouter(supabase: SupabaseClient) {
  const router = Router();

// Create a new document
router.post('/', async (req, res) => {
  try {
    const { title, userId } = req.body;

    if (!title || !userId) {
      return res.status(400).json({ error: 'Title and userId are required' });
    }

    const { data: document, error } = await supabase
      .from('documents')
      .insert([
        {
          title: title.trim(),
          content: '',
          created_by: userId,
          last_edited: new Date().toISOString(),
          last_edited_by: userId
        }
      ])
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.json({ document });
  } catch (error) {
    console.error('Create document error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all documents with participant count
router.get('/', async (req, res) => {
  try {
    const { data: documents, error } = await supabase
      .from('documents')
      .select(`
        *,
        creator:users!documents_created_by_fkey(username),
        last_editor:users!documents_last_edited_by_fkey(username)
      `)
      .order('last_edited', { ascending: false });

    if (error) {
      throw error;
    }

    // For each document, we could get active participants from Redis
    // For now, we'll return 0 as placeholder
    const documentsWithParticipants = documents.map(doc => ({
      ...doc,
      active_participants: 0
    }));

    res.json({ documents: documentsWithParticipants });
  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get a specific document with chat history
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 50 } = req.query;

    // Get document
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select(`
        *,
        creator:users!documents_created_by_fkey(username),
        last_editor:users!documents_last_edited_by_fkey(username)
      `)
      .eq('id', id)
      .single();

    if (docError) {
      if (docError.code === 'PGRST116') {
        return res.status(404).json({ error: 'Document not found' });
      }
      throw docError;
    }

    // Get chat messages
    const { data: messages, error: msgError } = await supabase
      .from('chat_messages')
      .select(`
        *,
        user:users(username)
      `)
      .eq('document_id', id)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit as string));

    if (msgError) {
      throw msgError;
    }

    res.json({
      document,
      messages: messages.reverse() // Reverse to get chronological order
    });
  } catch (error) {
    console.error('Get document error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update document content
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { content, userId } = req.body;

    if (!content || !userId) {
      return res.status(400).json({ error: 'Content and userId are required' });
    }

    const { data: document, error } = await supabase
      .from('documents')
      .update({
        content,
        last_edited: new Date().toISOString(),
        last_edited_by: userId
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.json({ document });
  } catch (error) {
    console.error('Update document error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete document
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('documents')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }

    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

  return router;
}