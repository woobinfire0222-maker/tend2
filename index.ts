import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authorization = request.headers.get('Authorization');
  const bearer = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const ownerDiscordId = Deno.env.get('TEND_OWNER_DISCORD_ID')?.trim();

  if (!supabaseUrl || !serviceRoleKey || !ownerDiscordId) {
    return json({ error: 'Owner bootstrap is not configured.' }, 503);
  }
  if (!/^\d{15,22}$/.test(ownerDiscordId)) {
    return json({ error: 'The configured owner Discord ID is invalid.' }, 503);
  }
  if (!bearer) return json({ error: 'Authentication required.' }, 401);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authResult, error: authError } = await admin.auth.getUser(bearer);
  const authUser = authResult.user;
  if (authError || !authUser) return json({ error: 'The login session is invalid or expired.' }, 401);

  const { data: fullResult, error: fullError } = await admin.auth.admin.getUserById(authUser.id);
  if (fullError || !fullResult.user) return json({ error: 'Unable to verify the Discord account.' }, 403);

  const discordIdentity = fullResult.user.identities?.find((identity) => identity.provider === 'discord');
  const identityData = (discordIdentity?.identity_data ?? {}) as Record<string, unknown>;
  const verifiedDiscordId = String(
    discordIdentity?.provider_id ?? identityData.sub ?? identityData.provider_id ?? '',
  );

  if (!verifiedDiscordId || verifiedDiscordId !== ownerDiscordId) {
    return json({ error: 'This Discord account is not the configured TEND owner.' }, 403);
  }

  const { data: ownerRole, error: roleError } = await admin
    .from('user_roles')
    .select('user_id')
    .eq('role', 'owner')
    .maybeSingle();
  if (roleError) return json({ error: 'Unable to verify the current owner assignment.' }, 500);
  if (ownerRole && ownerRole.user_id !== authUser.id) {
    return json({ error: 'An owner account has already been initialized.' }, 409);
  }

  const metadata = fullResult.user.user_metadata ?? {};
  const username = String(metadata.preferred_username ?? metadata.username ?? '');
  const displayName = String(metadata.full_name ?? metadata.name ?? username);
  const avatarUrl = String(metadata.avatar_url ?? metadata.picture ?? '');

  const { error: profileError } = await admin.from('profiles').upsert(
    {
      id: authUser.id,
      discord_id: verifiedDiscordId,
      username: username || null,
      display_name: displayName || null,
      avatar_url: avatarUrl || null,
    },
    { onConflict: 'id' },
  );
  if (profileError) return json({ error: 'Unable to initialize the owner profile.' }, 500);

  const { error: grantError } = await admin.from('user_roles').upsert(
    { user_id: authUser.id, role: 'owner', assigned_by: authUser.id },
    { onConflict: 'user_id' },
  );
  if (grantError) return json({ error: 'Unable to initialize owner permissions.' }, 500);

  const { error: auditError } = await admin.from('audit_logs').insert({
    actor_id: authUser.id,
    action: ownerRole ? 'owner.bootstrap.repeat' : 'owner.bootstrap',
    target_type: 'user',
    target_id: authUser.id,
    result: 'success',
  });
  if (auditError) return json({ error: 'Owner permissions were set, but the audit record failed.' }, 500);

  return json({ ok: true, role: 'owner' });
});
