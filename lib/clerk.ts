import { fetchWithTimeout } from '@/lib/fetchWithTimeout'

const CLERK_API_BASE = process.env.CLERK_API_URL || 'https://api.clerk.com/v1';
const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY || '';

async function clerkFetch(path: string, init?: RequestInit) {
  if (!CLERK_SECRET_KEY) throw new Error('CLERK_SECRET_KEY not set');
  const res = await fetchWithTimeout(`${CLERK_API_BASE}${path}`, {
    ...init,
    headers: {
      'Authorization': `Bearer ${CLERK_SECRET_KEY}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  }, 10000);
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Clerk API ${path} -> ${res.status}: ${txt}`);
  }
  return res.json();
}

export async function findUserByEmail(email: string) {
  const q = new URLSearchParams();
  q.append('email_address[]', email);
  const res = await clerkFetch(`/users?${q.toString()}`);
  return Array.isArray(res) ? (res[0] || null) : (res?.data?.[0] || null);
}

export async function createUser(params: { email: string; password: string; firstName?: string; lastName?: string; }) {
  const body = {
    email_address: [params.email],
    password: params.password,
    first_name: params.firstName,
    last_name: params.lastName,
  } as any;
  const res = await clerkFetch('/users', { method: 'POST', body: JSON.stringify(body) });
  return res;
}

export async function setUserPassword(userId: string, password: string) {
  // Update user password
  await clerkFetch(`/users/${userId}`, { method: 'PATCH', body: JSON.stringify({ password }) });
}

export async function addUserToOrganization(opts: { organizationId: string; userId: string; role?: string; roleId?: string; }) {
  const body: any = { user_id: opts.userId }
  if (opts.roleId) body.role_id = opts.roleId
  if (opts.role) body.role = opts.role
  return clerkFetch(`/organizations/${opts.organizationId}/memberships`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function listOrganizationMemberships(organizationId: string, userId: string) {
  const q = new URLSearchParams();
  q.append('user_id', userId);
  return clerkFetch(`/organizations/${organizationId}/memberships?${q.toString()}`);
}

export async function updateOrganizationMembershipRole(
  organizationId: string,
  membershipId: string,
  opts: { roleId?: string; role?: string }
) {
  const body: any = {};
  if (opts.roleId) body.role_id = opts.roleId;
  if (opts.role) body.role = opts.role;
  return clerkFetch(`/organizations/${organizationId}/memberships/${membershipId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

// Create an organization invitation for a given email
export async function inviteUserToOrganization(
  organizationId: string,
  email: string,
  opts: { roleId?: string; role?: string } = {}
) {
  const body: any = { email_address: email };
  if (opts.roleId) body.role_id = opts.roleId;
  if (opts.role) body.role = opts.role;
  return clerkFetch(`/organizations/${organizationId}/invitations`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
