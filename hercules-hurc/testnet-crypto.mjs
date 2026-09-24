const MASK64 = (1n << 64n) - 1n;
const RC = [
  0x0000000000000001n,0x0000000000008082n,0x800000000000808an,0x8000000080008000n,
  0x000000000000808bn,0x0000000080000001n,0x8000000080008081n,0x8000000000008009n,
  0x000000000000008an,0x0000000000000088n,0x0000000080008009n,0x000000008000000an,
  0x000000008000808bn,0x800000000000008bn,0x8000000000008089n,0x8000000000008003n,
  0x8000000000008002n,0x8000000000000080n,0x000000000000800an,0x800000008000000an,
  0x8000000080008081n,0x8000000000008080n,0x0000000080000001n,0x8000000080008008n,
];
const ROT = [
  0,1,62,28,27,
  36,44,6,55,20,
  3,10,43,25,39,
  41,45,15,21,8,
  18,2,61,56,14,
];

function rotl64(x, n) {
  const s = BigInt(n % 64);
  if (s === 0n) return x & MASK64;
  return ((x << s) | (x >> (64n - s))) & MASK64;
}

function keccakF(state) {
  for (const rc of RC) {
    const c = new Array(5).fill(0n);
    for (let x=0;x<5;x++) for (let y=0;y<5;y++) c[x] ^= state[x+5*y];
    const d = c.map((_,x) => c[(x+4)%5] ^ rotl64(c[(x+1)%5],1));
    for (let x=0;x<5;x++) for (let y=0;y<5;y++) state[x+5*y] = (state[x+5*y] ^ d[x]) & MASK64;

    const b = new Array(25).fill(0n);
    for (let x=0;x<5;x++) for (let y=0;y<5;y++) {
      const newX = y;
      const newY = (2*x + 3*y) % 5;
      b[newX + 5*newY] = rotl64(state[x+5*y], ROT[x+5*y]);
    }

    for (let y=0;y<5;y++) for (let x=0;x<5;x++) {
      state[x+5*y] =
        (b[x+5*y] ^ ((~b[(x+1)%5+5*y]) & b[(x+2)%5+5*y])) & MASK64;
    }

    state[0] = (state[0] ^ rc) & MASK64;
  }
}

export function keccak256(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const rate = 136;
  const padLen = rate - (bytes.length % rate);
  const padded = new Uint8Array(bytes.length + padLen);
  padded.set(bytes);
  padded[bytes.length] = 0x01;
  padded[padded.length - 1] |= 0x80;

  const state = new Array(25).fill(0n);
  for (let off=0; off<padded.length; off+=rate) {
    for (let i=0;i<rate/8;i++) {
      let lane = 0n;
      for (let j=0;j<8;j++) lane |= BigInt(padded[off+i*8+j]) << BigInt(8*j);
      state[i] ^= lane;
    }
    keccakF(state);
  }

  const out = new Uint8Array(32);
  for (let i=0;i<32;i++) {
    out[i] = Number((state[Math.floor(i/8)] >> BigInt(8*(i%8))) & 0xffn);
  }
  return out;
}

export function concatBytes(...parts) {
  const xs = parts.map((p) => p instanceof Uint8Array ? p : new Uint8Array(p));
  const out = new Uint8Array(xs.reduce((n,p) => n + p.length, 0));
  let offset = 0;
  for (const part of xs) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

export function bytesToHex(bytes) {
  return "0x" + [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function hexToBytes(hex) {
  const value = String(hex).replace(/^0x/, "");
  if (value.length % 2 || !/^[0-9a-f]*$/i.test(value)) throw new Error("invalid hex");
  return Uint8Array.from(
    {length: value.length / 2},
    (_, i) => parseInt(value.slice(i*2, i*2+2), 16),
  );
}

export function bytesToBigInt(bytes) {
  return BigInt(bytesToHex(bytes));
}

export function bigIntToBytes(value, length = null) {
  let hex = BigInt(value).toString(16);
  if (hex.length % 2) hex = "0" + hex;

  let bytes =
    hex === "00" && BigInt(value) === 0n
      ? new Uint8Array([])
      : hexToBytes(hex);

  if (length !== null) {
    if (bytes.length > length) throw new Error("integer too large");
    const out = new Uint8Array(length);
    out.set(bytes, length - bytes.length);
    bytes = out;
  }
  return bytes;
}

function rlpLengthBytes(length) {
  return bigIntToBytes(BigInt(length));
}

export function rlpEncode(value) {
  if (Array.isArray(value)) {
    const payload = concatBytes(...value.map(rlpEncode));
    if (payload.length <= 55) {
      return concatBytes(Uint8Array.of(0xc0 + payload.length), payload);
    }
    const len = rlpLengthBytes(payload.length);
    return concatBytes(Uint8Array.of(0xf7 + len.length), len, payload);
  }

  let bytes;
  if (value instanceof Uint8Array) bytes = value;
  else if (typeof value === "bigint" || typeof value === "number") {
    bytes = bigIntToBytes(BigInt(value));
  } else if (typeof value === "string") {
    bytes = value.startsWith("0x")
      ? hexToBytes(value)
      : new TextEncoder().encode(value);
  } else {
    throw new Error("unsupported RLP value");
  }

  if (bytes.length === 1 && bytes[0] < 0x80) return bytes;
  if (bytes.length <= 55) {
    return concatBytes(Uint8Array.of(0x80 + bytes.length), bytes);
  }
  const len = rlpLengthBytes(bytes.length);
  return concatBytes(Uint8Array.of(0xb7 + len.length), len, bytes);
}

export const SECP = Object.freeze({
  P: 0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2fn,
  N: 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n,
  G: Object.freeze({
    x: 0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798n,
    y: 0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8n,
  }),
});

function mod(a, m) {
  const r = a % m;
  return r >= 0n ? r : r + m;
}

function inverse(a, m) {
  let t = 0n;
  let newT = 1n;
  let r = m;
  let newR = mod(a, m);

  while (newR) {
    const q = r / newR;
    [t, newT] = [newT, t - q * newT];
    [r, newR] = [newR, r - q * newR];
  }

  if (r !== 1n) throw new Error("not invertible");
  return mod(t, m);
}

function pointAdd(a, b) {
  if (!a) return b;
  if (!b) return a;

  const P = SECP.P;
  if (a.x === b.x && mod(a.y + b.y, P) === 0n) return null;

  let slope;
  if (a.x === b.x && a.y === b.y) {
    if (a.y === 0n) return null;
    slope = mod(3n * a.x * a.x * inverse(2n * a.y, P), P);
  } else {
    slope = mod((b.y - a.y) * inverse(b.x - a.x, P), P);
  }

  const x = mod(slope * slope - a.x - b.x, P);
  const y = mod(slope * (a.x - x) - a.y, P);
  return {x, y};
}

function pointMultiply(point, scalar) {
  let k = mod(scalar, SECP.N);
  let result = null;
  let addend = point;

  while (k) {
    if (k & 1n) result = pointAdd(result, addend);
    addend = pointAdd(addend, addend);
    k >>= 1n;
  }
  return result;
}

export function privateKeyToPublicKey(privateKey) {
  const d =
    typeof privateKey === "bigint"
      ? privateKey
      : bytesToBigInt(
          privateKey instanceof Uint8Array ? privateKey : hexToBytes(privateKey),
        );

  if (d <= 0n || d >= SECP.N) throw new Error("invalid private key");
  return pointMultiply(SECP.G, d);
}

export function publicKeyToAddress(publicKey) {
  const raw = concatBytes(
    bigIntToBytes(publicKey.x, 32),
    bigIntToBytes(publicKey.y, 32),
  );
  return bytesToHex(keccak256(raw).slice(-20)).toLowerCase();
}

export function privateKeyToAddress(privateKey) {
  return publicKeyToAddress(privateKeyToPublicKey(privateKey));
}

export function generatePrivateKey(random = globalThis.crypto) {
  for (let i=0;i<1024;i++) {
    const bytes = new Uint8Array(32);
    random.getRandomValues(bytes);
    const d = bytesToBigInt(bytes);
    if (d > 0n && d < SECP.N) return bytes;
  }
  throw new Error("private key generation failed");
}

async function hmacSha256(key, data) {
  const imported = await globalThis.crypto.subtle.importKey(
    "raw",
    key,
    {name:"HMAC", hash:"SHA-256"},
    false,
    ["sign"],
  );
  return new Uint8Array(
    await globalThis.crypto.subtle.sign("HMAC", imported, data),
  );
}

async function deterministicNonce(privateKey, digest) {
  const x = privateKey instanceof Uint8Array ? privateKey : hexToBytes(privateKey);
  const z = bigIntToBytes(bytesToBigInt(digest) % SECP.N, 32);

  let V = new Uint8Array(32).fill(1);
  let K = new Uint8Array(32);

  K = await hmacSha256(K, concatBytes(V, Uint8Array.of(0), x, z));
  V = await hmacSha256(K, V);
  K = await hmacSha256(K, concatBytes(V, Uint8Array.of(1), x, z));
  V = await hmacSha256(K, V);

  for (let i=0;i<1024;i++) {
    V = await hmacSha256(K, V);
    const k = bytesToBigInt(V);
    if (k > 0n && k < SECP.N) return k;
    K = await hmacSha256(K, concatBytes(V, Uint8Array.of(0)));
    V = await hmacSha256(K, V);
  }

  throw new Error("deterministic nonce failed");
}

export async function signDigest(privateKey, digest) {
  const privateBytes =
    privateKey instanceof Uint8Array ? privateKey : hexToBytes(privateKey);

  if (privateBytes.length !== 32) {
    throw new Error("private key must be 32 bytes");
  }

  const d = bytesToBigInt(privateBytes);
  if (d <= 0n || d >= SECP.N) throw new Error("invalid private key");

  const z = bytesToBigInt(digest);
  const k = await deterministicNonce(privateBytes, digest);
  const R = pointMultiply(SECP.G, k);

  if (!R || R.x >= SECP.N) {
    throw new Error("rare nonce recovery overflow; generate another test key");
  }

  const r = R.x;
  let s = mod(inverse(k, SECP.N) * (z + r*d), SECP.N);
  if (r === 0n || s === 0n) throw new Error("invalid signature");

  let yParity = Number(R.y & 1n);
  if (s > SECP.N / 2n) {
    s = SECP.N - s;
    yParity ^= 1;
  }

  return {r, s, yParity};
}

export function verifyDigest(publicKey, digest, {r, s}) {
  if (r <= 0n || r >= SECP.N || s <= 0n || s >= SECP.N) return false;

  const z = bytesToBigInt(digest);
  const w = inverse(s, SECP.N);
  const u1 = mod(z * w, SECP.N);
  const u2 = mod(r * w, SECP.N);
  const point = pointAdd(
    pointMultiply(SECP.G, u1),
    pointMultiply(publicKey, u2),
  );

  return Boolean(point) && mod(point.x, SECP.N) === r;
}

export async function signEip1559Transaction(tx, privateKey) {
  if (BigInt(tx.chainId) !== 84532n) {
    throw new Error("HURC test signer only supports Base Sepolia chain 84532");
  }

  const fields = [
    BigInt(tx.chainId),
    BigInt(tx.nonce),
    BigInt(tx.maxPriorityFeePerGas),
    BigInt(tx.maxFeePerGas),
    BigInt(tx.gasLimit),
    tx.to ? hexToBytes(tx.to) : new Uint8Array([]),
    BigInt(tx.value ?? 0),
    hexToBytes(tx.data ?? "0x"),
    [],
  ];

  const unsigned = concatBytes(Uint8Array.of(0x02), rlpEncode(fields));
  const digest = keccak256(unsigned);
  const signature = await signDigest(privateKey, digest);

  const signed = concatBytes(
    Uint8Array.of(0x02),
    rlpEncode([
      ...fields,
      BigInt(signature.yParity),
      signature.r,
      signature.s,
    ]),
  );

  return {
    rawTransaction: bytesToHex(signed),
    transactionHash: bytesToHex(keccak256(signed)),
    from: privateKeyToAddress(privateKey),
    signature,
    digest: bytesToHex(digest),
  };
}
