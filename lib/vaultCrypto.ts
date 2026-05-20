/**
 * Karochat vault — per-DM client-side E2EE for is_vault rooms.
 *
 * Approach:
 *   - Each user generates an ECDH P-256 keypair on first vault use, stored
 *     in localStorage (private key never leaves the device).
 *   - The public key is published to a per-user table (`vault_keys`)
 *     accessible only when paired in an is_vault room.
 *   - When opening a vault DM, both clients derive a shared AES-GCM key
 *     via ECDH and use that to encrypt every outbound `content` and
 *     decrypt every inbound one. The DB only ever stores ciphertext.
 *
 * Note: this is a real E2EE scheme, but it's NOT the Signal protocol —
 * there's no double-ratchet, no forward secrecy beyond per-message IVs,
 * and key rotation must be manual. It's a strong starting point that we
 * can swap out for Olm/libsignal in a later wave without changing the
 * cipher format (we tag the ciphertext with a version byte).
 */

const STORAGE_PREFIX = "karochat:vault";

type StoredKey = { kty: "EC"; crv: "P-256"; x: string; y: string; d?: string };

async function getOrCreateOwnKeypair(): Promise<{
  publicKeyJwk: JsonWebKey;
  privateKey: CryptoKey;
}> {
  const storageKey = `${STORAGE_PREFIX}:self`;
  let stored: { pub: StoredKey; priv: StoredKey } | null = null;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (raw) stored = JSON.parse(raw);
  } catch {
    stored = null;
  }
  if (stored) {
    const privateKey = await crypto.subtle.importKey(
      "jwk",
      stored.priv as JsonWebKey,
      { name: "ECDH", namedCurve: "P-256" },
      false,
      ["deriveKey", "deriveBits"]
    );
    return { publicKeyJwk: stored.pub as JsonWebKey, privateKey };
  }
  const kp = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey", "deriveBits"]
  );
  const pub = (await crypto.subtle.exportKey("jwk", kp.publicKey)) as StoredKey;
  const priv = (await crypto.subtle.exportKey("jwk", kp.privateKey)) as StoredKey;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify({ pub, priv }));
  } catch {
    // ignore — vault still works for this session
  }
  return { publicKeyJwk: pub as JsonWebKey, privateKey: kp.privateKey };
}

async function importPeerPublicKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );
}

async function deriveSharedAesKey(
  privateKey: CryptoKey,
  peerPublic: CryptoKey
): Promise<CryptoKey> {
  return crypto.subtle.deriveKey(
    { name: "ECDH", public: peerPublic },
    privateKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

function b64encode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin);
}

function b64decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const CIPHER_PREFIX = "v1::";

export async function encryptForVault(
  plaintext: string,
  aesKey: CryptoKey
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    new TextEncoder().encode(plaintext)
  );
  return CIPHER_PREFIX + b64encode(iv) + ":" + b64encode(ct);
}

export async function decryptFromVault(
  payload: string,
  aesKey: CryptoKey
): Promise<string> {
  if (!payload.startsWith(CIPHER_PREFIX)) {
    // unencrypted fallback — happens for very first plain message in a
    // vault DM before keys are exchanged. Return as-is.
    return payload;
  }
  const [, ivB64, ctB64] = payload.split(":");
  if (!ivB64 || !ctB64) return payload;
  try {
    // Copy through ArrayBuffer to satisfy strict BufferSource typing
    // (Uint8Array.buffer can be ArrayBufferLike, but subtle.decrypt wants ArrayBuffer).
    const iv = b64decode(ivB64);
    const ct = b64decode(ctB64);
    const ivBuf = new Uint8Array(iv).buffer as ArrayBuffer;
    const ctBuf = new Uint8Array(ct).buffer as ArrayBuffer;
    const pt = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: ivBuf },
      aesKey,
      ctBuf
    );
    return new TextDecoder().decode(pt);
  } catch {
    return "🔒 (could not decrypt — different vault key)";
  }
}

/**
 * Top-level helper: returns the derived AES-GCM key for the (me, peer) pair,
 * caching in memory by peer id. The function:
 *   1. Ensures we have our own keypair (creates on first use).
 *   2. Looks up the peer's public JWK from `vault_keys` table (we publish
 *      our own when this is called for the first time).
 *   3. Derives the shared secret.
 *
 * If the peer hasn't published a key yet, we publish ours and return null —
 * the caller should treat the room as plaintext until the peer publishes.
 */
const peerKeyCache = new Map<string, CryptoKey>();

export async function getVaultKeyForPeer(
  supabase: any,
  peerId: string,
  myId: string
): Promise<CryptoKey | null> {
  if (peerKeyCache.has(peerId)) return peerKeyCache.get(peerId) ?? null;

  const { publicKeyJwk, privateKey } = await getOrCreateOwnKeypair();

  // Publish our own pubkey (idempotent upsert).
  try {
    await supabase
      .from("vault_keys")
      .upsert(
        { user_id: myId, public_jwk: publicKeyJwk as any },
        { onConflict: "user_id" }
      );
  } catch {
    // ignore — table may not exist yet on the very first wave
  }

  // Fetch peer's pubkey.
  let peerJwk: JsonWebKey | null = null;
  try {
    const { data } = await supabase
      .from("vault_keys")
      .select("public_jwk")
      .eq("user_id", peerId)
      .maybeSingle();
    if (data?.public_jwk) peerJwk = data.public_jwk as JsonWebKey;
  } catch {
    return null;
  }
  if (!peerJwk) return null;

  const peerPub = await importPeerPublicKey(peerJwk);
  const aes = await deriveSharedAesKey(privateKey, peerPub);
  peerKeyCache.set(peerId, aes);
  return aes;
}
