import { createClient } from "@supabase/supabase-js";

import { env } from "../configs/env.ts";

const supabaseUrl = env.SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Server-only Supabase client. The service-role key bypasses storage RLS, so
 * this module must never be imported into anything that ships to the browser.
 */
export const supabaseAdmin =
  supabaseUrl && serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      })
    : null;

export const uploadBucket = env.SUPABASE_STORAGE_BUCKET ?? null;

export const isUploadStorageConfigured = Boolean(supabaseAdmin && uploadBucket);
