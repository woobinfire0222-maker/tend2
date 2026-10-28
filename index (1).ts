import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function requiredString(data: Record<string, unknown>, key: string, maxLength = 200) {
  const value = data[key];
  if (typeof value !== 'string' || !value.trim() || value.length > maxLength) {
    throw new HttpError(400, `Invalid ${key}.`);
  }
  return value.trim();
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return response({ error: 'Method not allowed.' }, 405);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const expectedOwnerId = Deno.env.get('TEND_OWNER_DISCORD_ID')?.trim();
    const bearer = request.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!supabaseUrl || !serviceRoleKey || !expectedOwnerId) {
      throw new HttpError(503, 'Owner administration is not configured.');
    }
    if (!/^\d{15,22}$/.test(expectedOwnerId)) {
      throw new HttpError(503, 'The configured owner Discord ID is invalid.');
    }
    if (!bearer) throw new HttpError(401, 'Authentication required.');

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await admin.auth.getUser(bearer);
    if (authError || !authData.user) throw new HttpError(401, 'The login session is invalid or expired.');

    const actorId = authData.user.id;
    const { data: fullData, error: fullError } = await admin.auth.admin.getUserById(actorId);
    if (fullError || !fullData.user) throw new HttpError(403, 'Unable to verify the Discord account.');
    const identity = fullData.user.identities?.find((item) => item.provider === 'discord');
    const identityData = (identity?.identity_data ?? {}) as Record<string, unknown>;
    const discordId = String(identity?.provider_id ?? identityData.sub ?? identityData.provider_id ?? '');
    if (discordId !== expectedOwnerId) throw new HttpError(403, 'The configured owner Discord ID does not match.');

    const { data: ownerRole, error: roleError } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', actorId)
      .maybeSingle();
    if (roleError) throw new HttpError(500, 'Unable to verify owner permissions.');
    if (ownerRole?.role !== 'owner') throw new HttpError(403, 'Owner permission is required.');

    const payload = await request.json().catch(() => null);
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new HttpError(400, 'A JSON request body is required.');
    }
    const input = payload as Record<string, unknown>;
    const action = requiredString(input, 'action', 60);
    const audit = async (
      targetType: string,
      targetId: string | null,
      beforeValue: unknown,
      afterValue: unknown,
    ) => {
      const { error } = await admin.from('audit_logs').insert({
        actor_id: actorId,
        action: `owner.${action}`,
        target_type: targetType,
        target_id: targetId,
        before_value: beforeValue ?? null,
        after_value: afterValue ?? null,
        result: 'success',
      });
      if (error) throw new HttpError(500, 'The operation ran but its audit record could not be saved.');
    };

    switch (action) {
      case 'list_users': {
        const term = typeof input.term === 'string' ? input.term.trim().slice(0, 100) : '';
        const safeTerm = term.replace(/[^a-zA-Z0-9_-]/g, '');
        let usersQuery = admin
          .from('profiles')
          .select('id,discord_id,username,display_name,account_status,created_at,last_login_at')
          .order('created_at', { ascending: false })
          .limit(50);
        if (safeTerm) {
          usersQuery = usersQuery.or(
            `username.ilike.%${safeTerm}%,discord_id.ilike.%${safeTerm}%`,
          );
        }
        const { data, error } = await usersQuery;
        if (error) throw new HttpError(500, 'Unable to load users.');
        const ids = (data ?? []).map((user) => user.id);
        const { data: roles, error: rolesError } = ids.length
          ? await admin.from('user_roles').select('user_id,role').in('user_id', ids)
          : { data: [], error: null };
        if (rolesError) throw new HttpError(500, 'Unable to load user roles.');
        await audit('users', null, null, { search: term, resultCount: data?.length ?? 0 });
        return response({
          users: (data ?? []).map((user) => ({
            ...user,
            role: roles?.find((role) => role.user_id === user.id)?.role ?? 'user',
          })),
        });
      }
      case 'list_servers': {
        const { data, error } = await admin
          .from('servers')
          .select('id,discord_server_id,name,status,bot_status,bot_checked_at,created_by,created_at')
          .order('created_at', { ascending: false })
          .limit(100);
        if (error) throw new HttpError(500, 'Unable to load servers.');
        await audit('servers', null, null, { resultCount: data?.length ?? 0 });
        return response({ servers: data ?? [] });
      }
      case 'list_payments': {
        const { data, error } = await admin
          .from('payments')
          .select('id,pass_id,requester_id,amount,status,review_note,created_at')
          .order('created_at', { ascending: false })
          .limit(100);
        if (error) throw new HttpError(500, 'Unable to load payments.');
        const passIds = [...new Set((data ?? []).map((payment) => payment.pass_id))];
        const { data: passes, error: passesError } = passIds.length
          ? await admin
              .from('passes')
              .select('id,product_id,server_id,status,owner_id,starts_at,expires_at')
              .in('id', passIds)
          : { data: [], error: null };
        if (passesError) throw new HttpError(500, 'Unable to load pass details.');
        const serverIds = [...new Set((passes ?? []).map((pass) => pass.server_id))];
        const productIds = [...new Set((passes ?? []).map((pass) => pass.product_id))];
        const [serversResult, productsResult] = await Promise.all([
          serverIds.length
            ? admin.from('servers').select('id,discord_server_id,name').in('id', serverIds)
            : Promise.resolve({ data: [], error: null }),
          productIds.length
            ? admin.from('pass_products').select('id,name,duration_days').in('id', productIds)
            : Promise.resolve({ data: [], error: null }),
        ]);
        if (serversResult.error || productsResult.error) throw new HttpError(500, 'Unable to load payment references.');
        await audit('payments', null, null, { resultCount: data?.length ?? 0 });
        return response({
          payments: (data ?? []).map((payment) => {
            const pass = passes?.find((item) => item.id === payment.pass_id);
            return {
              ...payment,
              pass: pass
                ? {
                    ...pass,
                    server: serversResult.data?.find((server) => server.id === pass.server_id) ?? null,
                    product: productsResult.data?.find((product) => product.id === pass.product_id) ?? null,
                  }
                : null,
            };
          }),
        });
      }
      case 'list_products': {
        const { data, error } = await admin
          .from('pass_products')
          .select('id,name,duration_days,price,active,created_at,updated_at')
          .order('duration_days');
        if (error) throw new HttpError(500, 'Unable to load pass products.');
        await audit('pass_products', null, null, { resultCount: data?.length ?? 0 });
        return response({ products: data ?? [] });
      }
      case 'get_maintenance': {
        const { data, error } = await admin
          .from('service_settings')
          .select('key,value')
          .in('key', ['maintenance_enabled', 'maintenance_message']);
        if (error) throw new HttpError(500, 'Unable to load maintenance settings.');
        const settings = Object.fromEntries((data ?? []).map((row) => [row.key, row.value]));
        await audit('service_settings', 'maintenance', null, { action: 'read' });
        return response({
          enabled: settings.maintenance_enabled === true,
          message: typeof settings.maintenance_message === 'string' ? settings.maintenance_message : '',
        });
      }
      case 'list_tickets': {
        const { data, error } = await admin
          .from('tickets')
          .select('id,requester_id,subject,category,status,assignee_id,created_at,updated_at')
          .order('updated_at', { ascending: false })
          .limit(100);
        if (error) throw new HttpError(500, 'Unable to load tickets.');
        const profileIds = [...new Set((data ?? []).flatMap((ticket) => [ticket.requester_id, ticket.assignee_id].filter(Boolean)))];
        const { data: profiles, error: profilesError } = profileIds.length
          ? await admin.from('profiles').select('id,username,display_name').in('id', profileIds as string[])
          : { data: [], error: null };
        if (profilesError) throw new HttpError(500, 'Unable to load ticket participants.');
        await audit('tickets', null, null, { resultCount: data?.length ?? 0 });
        return response({
          tickets: (data ?? []).map((ticket) => ({
            ...ticket,
            requester: profiles?.find((profile) => profile.id === ticket.requester_id) ?? null,
            assignee: profiles?.find((profile) => profile.id === ticket.assignee_id) ?? null,
          })),
        });
      }
      case 'list_audit': {
        const { data, error } = await admin
          .from('audit_logs')
          .select('id,actor_id,action,target_type,target_id,before_value,after_value,result,created_at')
          .order('created_at', { ascending: false })
          .limit(100);
        if (error) throw new HttpError(500, 'Unable to load the audit log.');
        await audit('audit_logs', null, null, { resultCount: data?.length ?? 0 });
        return response({ logs: data ?? [] });
      }
      case 'ticket_messages': {
        const ticketId = requiredString(input, 'ticketId', 36);
        if (!isUuid(ticketId)) throw new HttpError(400, 'Invalid ticket ID.');
        const { data: ticket, error: ticketError } = await admin
          .from('tickets')
          .select('id')
          .eq('id', ticketId)
          .maybeSingle();
        if (ticketError) throw new HttpError(500, 'Unable to verify the ticket.');
        if (!ticket) throw new HttpError(404, 'Ticket not found.');
        const { data: room, error: roomError } = await admin
          .from('chat_rooms')
          .select('id')
          .eq('ticket_id', ticketId)
          .maybeSingle();
        if (roomError) throw new HttpError(500, 'Unable to load the ticket conversation.');
        if (!room) return response({ messages: [] });
        const { data: messages, error: messagesError } = await admin
          .from('chat_messages')
          .select('id,room_id,author_id,body,created_at,edited_at,deleted_at')
          .eq('room_id', room.id)
          .order('created_at', { ascending: true })
          .limit(100);
        if (messagesError) throw new HttpError(500, 'Unable to load ticket messages.');
        const authorIds = [...new Set((messages ?? []).map((message) => message.author_id))];
        const { data: profiles, error: profileError } = authorIds.length
          ? await admin.from('profiles').select('id,username,display_name').in('id', authorIds)
          : { data: [], error: null };
        if (profileError) throw new HttpError(500, 'Unable to load message authors.');
        await audit('ticket', ticketId, null, { action: 'read_messages' });
        return response({
          messages: (messages ?? []).map((message) => ({
            ...message,
            author: profiles?.find((profile) => profile.id === message.author_id) ?? null,
          })),
        });
      }
      case 'set_account_status': {
        const userId = requiredString(input, 'userId', 36);
        const status = input.status;
        if (!isUuid(userId) || !['active', 'restricted'].includes(String(status))) {
          throw new HttpError(400, 'Invalid user or account status.');
        }
        const { data: role, error: roleLookupError } = await admin
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .maybeSingle();
        if (roleLookupError) throw new HttpError(500, 'Unable to verify the target account.');
        if (role?.role === 'owner') throw new HttpError(403, 'The owner account cannot be restricted here.');
        const { data: before, error: lookupError } = await admin
          .from('profiles')
          .select('id,account_status')
          .eq('id', userId)
          .single();
        if (lookupError) throw new HttpError(404, 'User not found.');
        const { error } = await admin.from('profiles').update({ account_status: status }).eq('id', userId);
        if (error) throw new HttpError(500, 'Unable to update account status.');
        await audit('user', userId, before, { ...before, account_status: status });
        return response({ ok: true });
      }
      case 'set_staff_role': {
        const userId = requiredString(input, 'userId', 36);
        const enabled = input.enabled;
        if (!isUuid(userId) || typeof enabled !== 'boolean') throw new HttpError(400, 'Invalid staff role request.');
        if (userId === actorId) throw new HttpError(400, 'The owner cannot change their own staff role.');
        const { data: before, error: lookupError } = await admin
          .from('user_roles')
          .select('user_id,role')
          .eq('user_id', userId)
          .maybeSingle();
        if (lookupError) throw new HttpError(500, 'Unable to load the target role.');
        if (before?.role === 'owner') throw new HttpError(403, 'Owner permissions cannot be changed here.');
        const { error } = await admin.from('user_roles').upsert(
          { user_id: userId, role: enabled ? 'staff' : 'user', assigned_by: actorId },
          { onConflict: 'user_id' },
        );
        if (error) throw new HttpError(500, 'Unable to update staff permissions.');
        await audit('user_role', userId, before, { user_id: userId, role: enabled ? 'staff' : 'user' });
        return response({ ok: true });
      }
      case 'review_payment': {
        const paymentId = requiredString(input, 'paymentId', 36);
        const status = input.status;
        const reviewNote = typeof input.note === 'string' ? input.note.trim().slice(0, 1000) : '';
        if (!isUuid(paymentId) || !['paid', 'rejected', 'refunded'].includes(String(status))) {
          throw new HttpError(400, 'Invalid payment review.');
        }
        const { data: payment, error: paymentError } = await admin
          .from('payments')
          .select('*')
          .eq('id', paymentId)
          .single();
        if (paymentError) throw new HttpError(404, 'Payment not found.');
        if (status === 'refunded' ? payment.status !== 'paid' : payment.status !== 'pending') {
          throw new HttpError(409, 'The payment status has already changed.');
        }
        const { data: pass, error: passError } = await admin
          .from('passes')
          .select('id,product_id,server_id,status')
          .eq('id', payment.pass_id)
          .single();
        if (passError) throw new HttpError(500, 'Unable to load the pass.');
        const { data: product, error: productError } = await admin
          .from('pass_products')
          .select('duration_days')
          .eq('id', pass.product_id)
          .single();
        if (productError) throw new HttpError(500, 'Unable to load the pass product.');

        const reviewedAt = new Date().toISOString();
        const { error: updatePaymentError } = await admin.from('payments').update({
          status,
          reviewed_by: actorId,
          reviewed_at: reviewedAt,
          review_note: reviewNote || null,
        }).eq('id', paymentId);
        if (updatePaymentError) throw new HttpError(500, 'Unable to update payment review.');

        if (status === 'paid') {
          const start = new Date();
          const end = new Date(start.getTime() + product.duration_days * 24 * 60 * 60 * 1000);
          const { error } = await admin.from('passes').update({
            status: 'paid',
            starts_at: start.toISOString(),
            expires_at: end.toISOString(),
            management_status: 'pending',
          }).eq('id', pass.id);
          if (error) throw new HttpError(500, 'Payment was recorded but pass activation failed.');
        } else {
          const { error } = await admin.from('passes').update({
            status,
            management_status: status === 'refunded' ? 'ended' : 'inactive',
          }).eq('id', pass.id);
          if (error) throw new HttpError(500, 'Payment was recorded but pass status could not be updated.');
        }
        await audit('payment', paymentId, payment, { ...payment, status, reviewed_by: actorId, review_note: reviewNote || null });
        return response({ ok: true });
      }
      case 'set_server_state': {
        const serverId = requiredString(input, 'serverId', 36);
        const status = input.status;
        if (!isUuid(serverId) || !['active', 'paused', 'disconnected'].includes(String(status))) {
          throw new HttpError(400, 'Invalid server status request.');
        }
        const { data: server, error: serverError } = await admin
          .from('servers')
          .select('*')
          .eq('id', serverId)
          .single();
        if (serverError) throw new HttpError(404, 'Server not found.');
        if (status === 'active') {
          const now = new Date().toISOString();
          const [{ data: activePass }, { data: verifiedManager }] = await Promise.all([
            admin.from('passes').select('id').eq('server_id', serverId).eq('status', 'paid').gt('expires_at', now).limit(1).maybeSingle(),
            admin.from('server_memberships').select('user_id').eq('server_id', serverId).eq('status', 'active').eq('membership_role', 'manager').eq('verified_manage_permission', true).limit(1).maybeSingle(),
          ]);
          if (server.bot_status !== 'online' || !activePass || !verifiedManager) {
            throw new HttpError(409, 'Server activation requires an online bot, a valid paid pass, and verified manager permission.');
          }
        }
        const { error } = await admin.from('servers').update({
          status,
          managed_since: status === 'active' ? new Date().toISOString() : null,
        }).eq('id', serverId);
        if (error) throw new HttpError(500, 'Unable to update server state.');
        await audit('server', serverId, server, { ...server, status });
        return response({ ok: true });
      }
      case 'set_product': {
        const name = requiredString(input, 'name', 120);
        const durationDays = Number(input.durationDays);
        const price = Number(input.price);
        const active = input.active;
        const productId = typeof input.productId === 'string' ? input.productId : null;
        if (![1, 10, 30].includes(durationDays) || !Number.isFinite(price) || price < 0 || typeof active !== 'boolean') {
          throw new HttpError(400, 'Products must use a 1, 10, or 30 day term and a valid price.');
        }
        let before: Record<string, unknown> | null = null;
        if (productId) {
          if (!isUuid(productId)) throw new HttpError(400, 'Invalid product ID.');
          const { data, error } = await admin.from('pass_products').select('*').eq('id', productId).single();
          if (error) throw new HttpError(404, 'Pass product not found.');
          before = data;
        }
        const values = { name, duration_days: durationDays, price, active };
        const query = productId
          ? admin.from('pass_products').update(values).eq('id', productId).select('*').single()
          : admin.from('pass_products').insert(values).select('*').single();
        const { data, error } = await query;
        if (error) throw new HttpError(500, 'Unable to save pass product.');
        await audit('pass_product', data.id, before, data);
        return response({ product: data });
      }
      case 'set_ticket': {
        const ticketId = requiredString(input, 'ticketId', 36);
        const status = input.status;
        if (!isUuid(ticketId) || !['open', 'in_progress', 'resolved', 'closed'].includes(String(status))) {
          throw new HttpError(400, 'Invalid ticket update.');
        }
        const assigneeId = input.assigneeId === null || input.assigneeId === '' ? null : String(input.assigneeId);
        if (assigneeId && !isUuid(assigneeId)) throw new HttpError(400, 'Invalid assignee.');
        const { data: before, error: lookupError } = await admin.from('tickets').select('*').eq('id', ticketId).single();
        if (lookupError) throw new HttpError(404, 'Ticket not found.');
        if (assigneeId) {
          const { data: role, error } = await admin.from('user_roles').select('role').eq('user_id', assigneeId).maybeSingle();
          if (error) throw new HttpError(500, 'Unable to verify assignee.');
          if (!role || !['staff', 'owner'].includes(role.role)) throw new HttpError(400, 'Assignee must be a staff member.');
        }
        const { data, error } = await admin.from('tickets').update({
          status,
          assignee_id: assigneeId,
          resolved_at: ['resolved', 'closed'].includes(String(status)) ? new Date().toISOString() : null,
        }).eq('id', ticketId).select('*').single();
        if (error) throw new HttpError(500, 'Unable to update ticket.');
        await audit('ticket', ticketId, before, data);
        return response({ ticket: data });
      }
      case 'reply_ticket': {
        const ticketId = requiredString(input, 'ticketId', 36);
        const body = requiredString(input, 'body', 10000);
        if (!isUuid(ticketId)) throw new HttpError(400, 'Invalid ticket ID.');
        const { data: ticket, error: ticketError } = await admin.from('tickets').select('id,requester_id,status').eq('id', ticketId).single();
        if (ticketError) throw new HttpError(404, 'Ticket not found.');
        if (['resolved', 'closed'].includes(ticket.status)) throw new HttpError(409, 'This ticket is closed.');
        const { data: room, error: roomError } = await admin.from('chat_rooms').select('id').eq('ticket_id', ticketId).single();
        if (roomError) throw new HttpError(500, 'Ticket conversation is unavailable.');
        const { data: message, error: messageError } = await admin.from('chat_messages').insert({
          room_id: room.id,
          author_id: actorId,
          body,
        }).select('id').single();
        if (messageError) throw new HttpError(500, 'Unable to send the reply.');
        await admin.from('tickets').update({ status: 'in_progress', assignee_id: actorId }).eq('id', ticketId);
        await audit('ticket', ticketId, { status: ticket.status }, { messageId: message.id, status: 'in_progress' });
        return response({ ok: true });
      }
      case 'set_maintenance': {
        if (typeof input.enabled !== 'boolean') throw new HttpError(400, 'Maintenance state must be boolean.');
        const message = typeof input.message === 'string' ? input.message.trim().slice(0, 1000) : '';
        const { data: before } = await admin
          .from('service_settings')
          .select('key,value')
          .in('key', ['maintenance_enabled', 'maintenance_message']);
        const updates = [
          { key: 'maintenance_enabled', value: input.enabled, updated_by: actorId },
          { key: 'maintenance_message', value: message, updated_by: actorId },
        ];
        const { error } = await admin.from('service_settings').upsert(updates, { onConflict: 'key' });
        if (error) throw new HttpError(500, 'Unable to update maintenance settings.');
        await audit('service_settings', 'maintenance', before, updates);
        return response({ ok: true });
      }
      default:
        throw new HttpError(400, 'Unsupported owner operation.');
    }
  } catch (error) {
    if (error instanceof HttpError) return response({ error: error.message }, error.status);
    return response({ error: error instanceof Error ? error.message : 'Owner operation failed.' }, 500);
  }
});
