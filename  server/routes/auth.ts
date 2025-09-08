import { Router } from 'express';
import { SupabaseClient } from '@supabase/supabase-js';

export function authRouter(supabase: SupabaseClient) {
  const router = Router();

// User login/register (username only)
router.post('/login', async (req, res) => {
  try {
    const { username } = req.body;

    if (!username || username.trim().length === 0) {
      return res.status(400).json({ error: 'Username is required' });
    }

    // Check if user exists
    const { data: existingUser, error: findError } = await supabase
      .from('users')
      .select('*')
      .eq('username', username.trim())
      .single();

    let user;
    if (findError && findError.code === 'PGRST116') {
      // User doesn't exist, create new one
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert([
          {
            username: username.trim(),
            last_seen: new Date().toISOString(),
            is_active: true
          }
        ])
        .select()
        .single();

      if (createError) {
        throw createError;
      }
      user = newUser;
    } else if (findError) {
      throw findError;
    } else {
      // User exists, update last_seen and set active
      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update({
          last_seen: new Date().toISOString(),
          is_active: true
        })
        .eq('id', existingUser.id)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }
      user = updatedUser;
    }

    res.json({
      user,
      message: 'Login successful'
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Logout user
router.post('/logout', async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const { error } = await supabase
      .from('users')
      .update({
        is_active: false,
        last_seen: new Date().toISOString()
      })
      .eq('id', userId);

    if (error) {
      throw error;
    }

    res.json({ message: 'Logout successful' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get active users
router.get('/active-users', async (req, res) => {
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('id, username, last_seen')
      .eq('is_active', true)
      .order('last_seen', { ascending: false });

    if (error) {
      throw error;
    }

    res.json({ users });
  } catch (error) {
    console.error('Get active users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

  return router;
}