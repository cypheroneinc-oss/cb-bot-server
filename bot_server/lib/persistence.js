import { getSupabaseAdmin } from './supabase.js';

export async function createOrReuseSession({ userId, version = 1 }) {
  if (!userId) {
    throw new Error('userId is required to create a session');
  }

  const supabase = getSupabaseAdmin();

  const existing = await supabase
    .from('diagnostic_sessions')
    .select('id')
    .eq('user_id', userId)
    .eq('question_set_version', version)
    .is('finished_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing.error && existing.error.code !== 'PGRST116') {
    throw existing.error;
  }

  if (existing.data?.id) {
    return { sessionId: existing.data.id };
  }

  const inserted = await supabase
    .from('diagnostic_sessions')
    .insert({ user_id: userId, question_set_version: version })
    .select('id')
    .single();

  if (inserted.error) {
    throw inserted.error;
  }

  return { sessionId: inserted.data.id };
}

export async function saveAnswers({ sessionId, answers }) {
  if (!sessionId) {
    throw new Error('sessionId is required to save answers');
  }

  const supabase = getSupabaseAdmin();

  await supabase.from('answers').delete().eq('session_id', sessionId);

  if (!Array.isArray(answers) || answers.length === 0) {
    return;
  }

  const payload = answers.map(({ question_id, choice_key }) => ({
    session_id: sessionId,
    question_id,
    choice_key
  }));

  const { error } = await supabase.from('answers').insert(payload);
  if (error) {
    throw error;
  }
}

export async function saveScores({ sessionId, factorScores, total }) {
  if (!sessionId) {
    throw new Error('sessionId is required to save scores');
  }

  if (!factorScores) {
    throw new Error('factorScores are required to save scores');
  }

  const supabase = getSupabaseAdmin();

  const payload = {
    session_id: sessionId,
    mbti: factorScores.mbti,
    safety: factorScores.safety,
    workstyle: factorScores.workstyle,
    motivation: factorScores.motivation,
    ng: factorScores.ng,
    sync: factorScores.sync,
    total: total ?? factorScores.total ?? 0
  };

  const { error } = await supabase
    .from('scores')
    .upsert(payload, { onConflict: 'session_id' });

  if (error) {
    throw error;
  }
}

export async function saveResult({ sessionId, cluster, heroSlug }) {
  if (!sessionId) {
    throw new Error('sessionId is required to save result');
  }

  if (!cluster || !heroSlug) {
    throw new Error('cluster and heroSlug are required');
  }

  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from('result_assignments')
    .upsert(
      { session_id: sessionId, cluster, hero_slug: heroSlug },
      { onConflict: 'session_id' }
    );

  if (error) {
    throw error;
  }
}

export async function getShareCardImage(heroSlug) {
  if (!heroSlug) {
    return null;
  }

  const supabase = getSupabaseAdmin({ optional: true });
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
