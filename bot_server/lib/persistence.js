import { getSupabaseClient } from './supabase.js';
import { QUESTION_VERSION } from './scoring.js';

export async function ensureSession(sessionId, { userId } = {}) {
  const client = getSupabaseClient({ optional: true });
  if (!client) {
    return { sessionId, userId: userId ?? null, persisted: false, exists: true };
  }

  const { data, error } = await client
    .from('diagnostic_sessions')
    .select('id, user_id')
    .eq('id', sessionId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (data) {
    return { sessionId: data.id, userId: data.user_id, persisted: true, exists: true };
  }

  if (!userId) {
    return { sessionId, userId: null, persisted: false, exists: false };
  }

  const insert = await client.from('diagnostic_sessions').insert({
    id: sessionId,
    user_id: userId,
    question_set_version: QUESTION_VERSION
  });

  if (insert.error) {
    throw insert.error;
  }

  return { sessionId, userId, persisted: true, exists: true };
}

export async function persistAnswers(sessionId, answers) {
  const client = getSupabaseClient({ optional: true });
  if (!client) {
    return { persisted: false };
  }

  await client.from('answers').delete().eq('session_id', sessionId);
  const payload = answers.map(({ questionId, choiceKey }) => ({
    session_id: sessionId,
    question_id: questionId,
    choice_key: choiceKey
  }));
  const { error } = await client.from('answers').insert(payload);
  if (error) {
    throw error;
  }
  return { persisted: true };
}

export async function persistScores(sessionId, scores) {
  const client = getSupabaseClient({ optional: true });
  if (!client) {
    return { persisted: false };
  }
  const { error } = await client
    .from('scores')
    .upsert({
      session_id: sessionId,
      mbti: scores.mbti,
      safety: scores.safety,
      workstyle: scores.workstyle,
      motivation: scores.motivation,
      ng: scores.ng,
      sync: scores.sync,
      total: scores.total
    });
  if (error) {
    throw error;
  }
  return { persisted: true };
}

export async function persistAssignment(sessionId, cluster, heroSlug) {
  const client = getSupabaseClient({ optional: true });
  if (!client) {
    return { persisted: false, asset: null };
  }

  const { data, error } = await client
    .from('result_assignments')
    .upsert({ session_id: sessionId, cluster, hero_slug: heroSlug })
    .select('session_id')
    .single();
  if (error) {
    throw error;
  }

  const asset = await client
    .from('share_card_assets')
    .select('image_url')
    .eq('hero_slug', heroSlug)
    .maybeSingle();

  if (asset.error) {
    throw asset.error;
  }

  return { persisted: true, asset: asset.data };
}
