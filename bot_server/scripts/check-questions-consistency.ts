import process from 'node:process';
import { createClient } from '@supabase/supabase-js';
import questions from '../data/questions.v1.js';

interface QuestionRow {
  code: string;
  sort_order: number;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`ENV ${name} is required`);
  }
  return value;
}

async function main(): Promise<void> {
  const url = requireEnv('SUPABASE_URL');
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_ANON_KEY;

  if (!serviceKey) {
    throw new Error('ENV SUPABASE_SERVICE_ROLE_KEY (or fallback) is required');
  }

  const client = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data, error } = await client
    .from('questions')
    .select('code, sort_order')
    .order('sort_order', { ascending: true });

  if (error) {
    throw new Error(`Supabase query failed: ${error.message}`);
  }

  if (!data) {
    throw new Error('Supabase returned no rows');
  }

  const expectedCodes = questions.map((q, index) => ({ code: q.id, sort_order: index + 1 }));

  if (data.length !== expectedCodes.length) {
    throw new Error(
      `Question count mismatch. Expected ${expectedCodes.length}, got ${data.length}.`
    );
  }

  const mismatched: string[] = [];

  data.forEach((row: QuestionRow, index: number) => {
    const expected = expectedCodes[index];
    if (!row.code) {
      mismatched.push(`row ${index + 1} missing code`);
      return;
    }

    if (row.code !== expected.code) {
      mismatched.push(`row ${index + 1}: expected code ${expected.code}, got ${row.code}`);
    }

    if (row.sort_order !== expected.sort_order) {
      mismatched.push(
        `row ${index + 1}: expected sort_order ${expected.sort_order}, got ${row.sort_order}`
      );
    }
  });

  if (mismatched.length > 0) {
    const message = mismatched.join('\n');
    throw new Error(`Question dataset mismatch:\n${message}`);
  }

  console.log(`Questions dataset matches Supabase table (${data.length} entries).`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
