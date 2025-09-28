import crypto from 'node:crypto';
import { getSupabaseAdmin } from './supabase.js';

// 環境フラグ：1 なら保存系を完全停止（NOOP）
const PERSISTENCE_DISABLED = process.env.PERSISTENCE_DISABLED === '1';

function generateSessionId() {
  return crypto.randomUUID?.() ?? `local-${Date.now()}`;
}

function resolveSupabase() {
  if (PERSISTENCE_DISABLED) return null;
  try {
    return getSupabaseAdmin();
  } catch (error) {
    // 環境未設定はNOOP運用にする（UI優先）
    if (error?.message?.includes('Missing SUPABASE_URL')) {
      console.warn('[supabase] Not configured, skipping persistence');
      return null;
    }
    console.warn('[supabase] init error, fallback to NOOP:', error);
    return null;
  }
}

export async function createOrReuseSession({ userId, version = 2, client = 'liff' }) {
  if (!userId) throw new Error('userId is required to create a session');

  const supabase = resolveSupabase();
  if (!supabase) {
    // DBが無くてもUIを進める
    return { sessionId: generateSessionId() };
  }

  try {
    const payload = { user_id: userId, version, client };
    const { data, error } = await supabase
      .from('diagnosis_sessions')
      .insert(payload)
      .select('session_id')
      .single();

    if (error) throw error;
    return { sessionId: data.session_id };
  } catch (e) {
    console.warn('[persistence:createOrReuseSession] fallback sessionId:', e?.message || e);
    return { sessionId: generateSessionId() };
  }
}

export async function saveAnswers({ sessionId, answers }) {
  if (!sessionId) throw new Error('sessionId is required to save answers');
  if (!Array.isArray(answers)) throw new Error('answers must be an array');

  const supabase = resolveSupabase();
  if (!supabase) return; // NOOP

  try {
    await supabase.from('diagnosis_answers').delete().eq('session_id', sessionId);

    if (!answers.length) return;

    const rows = answers.map(({ qid, scale, scale_max, choice }) => {
      if (typeof scale !== 'number' || typeof scale_max !== 'number') {
        throw new Error('scale and scale_max are required to persist answers');
      }
      return { session_id: sessionId, qid, scale, scale_max, choice };
    });

    const { error } = await supabase.from('diagnosis_answers').insert(rows);
    if (error) throw error;
  } catch (e) {
    // 保存失敗はUIを止めない
    console.warn('[persistence:saveAnswers]', e?.message || e);
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
  if (!sessionId) throw new Error('sessionId is required to save result');
  if (!cluster || !heroSlug || !heroName) throw new Error('cluster, heroSlug, and heroName are required');

  const supabase = resolveSupabase();
  if (!supabase) return; // NOOP

  try {
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

    if (error) throw error;
  } catch (e) {
    console.warn('[persistence:saveResult]', e?.message || e);
  }
}

export async function getShareCardImage(heroSlug) {
  if (!heroSlug) return null;

  const supabase = resolveSupabase();
  if (!supabase) return null; // NOOP

  try {
    const { data, error } = await supabase
      .from('share_card_assets')
      .select('image_url')
      .eq('hero_slug', heroSlug)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') throw error;
    return data?.image_url ?? null;
  } catch (e) {
    console.warn('[persistence:getShareCardImage]', e?.message || e);
    return null;
  }
}
