import crypto from 'node:crypto';
import { getSupabaseAdmin } from './supabase.js';

function generateSessionId() {
  return crypto.randomUUID?.() ?? `local-${Date.now()}`;
}

function resolveSupabase() {
  try {
    return getSupabaseAdmin();
  } catch (error) {
    if (error?.message?.includes('Missing SUPABASE_URL')) {
      console.warn('[supabase] Not configured, skipping persistence');
      return null;
    }
    throw error;
  }
}

export async function createOrReuseSession({ userId, version = 2, client = 'liff' }) {
  if (!userId) {
    throw new Error('userId is required to create a session');
  }

  const supabase = resolveSupabase();
  if (!supabase) {
    return { sessionId: generateSessionId() };
  }

  const payload = { user_id: userId, version, client };
  const { data, error } = await supabase
    .from('diagnosis_sessions')
    .insert(payload)
    .select('session_id')
    .single();

  if (error) {
    throw error;
  }

  return { sessionId: data.session_id };
}

export async function saveAnswers({ sessionId, answers }) {
  if (!sessionId) {
    throw new Error('sessionId is required to save answers');
  }

  if (!Array.isArray(answers)) {
    throw new Error('answers must be an array');
  }

  const supabase = resolveSupabase();
  if (!supabase) {
    return;
  }

  await supabase.from('diagnosis_answers').delete().eq('session_id', sessionId);

  if (!answers.length) {
    return;
  }

  const rows = answers.map(({ qid, scale, scale_max, choice }) => {
    if (typeof scale !== 'number' || typeof scale_max !== 'number') {
      throw new Error('scale and scale_max are required to persist answers');
    }

    return {
      session_id: sessionId,
      qid,
      scale,
      scale_max,
      choice,
    };
  });

  const { error } = await supabase.from('diagnosis_answers').insert(rows);
  if (error) {
    throw error;
  }
}

export async function saveResult({
  sessionId,
  cluster,
  heroSlug,
  heroName,
  scores,
  shareCardUrl,
}) {
  if (!sessionId) {
    throw new Error('sessionId is required to save result');
  }
  if (!cluster || !heroSlug || !heroName) {
    throw new Error('cluster, heroSlug, and heroName are required');
  }

  const supabase = resolveSupabase();
  if (!supabase) {
    return;
  }

  const payload = {
    session_id: sessionId,
    cluster_key: cluster,
    hero_slug: heroSlug,
    hero_name: heroName,
    scores,
    share_card_url: shareCardUrl ?? null,
  };

  const { error } = await supabase
    .from('diagnosis_results')
    .upsert(payload, { onConflict: 'session_id' });

  if (error) {
    throw error;
  }
}

export async function getShareCardImage(heroSlug) {
  if (!heroSlug) {
    return null;
  }

  const supabase = resolveSupabase();
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from('share_card_assets')
    .select('image_url')
    .eq('hero_slug', heroSlug)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  return data?.image_url ?? null;
}
