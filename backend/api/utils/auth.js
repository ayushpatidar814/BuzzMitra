import crypto from "crypto";

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;

const toBase64Url = (input) =>
  Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

const fromBase64Url = (input) =>
  Buffer.from(
    input.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (input.length % 4 || 4)) % 4),
    "base64"
  ).toString("utf8");

export const createPasswordHash = (password, salt = crypto.randomBytes(16).toString("hex")) => {
  const passwordHash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { salt, passwordHash };
};

export const verifyPassword = (password, salt, passwordHash) => {
  if (!salt || !passwordHash) return false;
  const computed = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(computed, "hex"), Buffer.from(passwordHash, "hex"));
};

export const signAuthToken = ({ userId, email }) => {
  const header = toBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = toBase64Url(
    JSON.stringify({
      sub: userId,
      email,
      exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
      iat: Math.floor(Date.now() / 1000),
    })
  );
  const unsigned = `${header}.${payload}`;
  const signature = crypto
    .createHmac("sha256", process.env.JWT_SECRET)
    .update(unsigned)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  return `${unsigned}.${signature}`;
};

export const verifyAuthToken = (token) => {
  if (!token) throw new Error("Missing token");
  const [header, payload, signature] = token.split(".");
  if (!header || !payload || !signature) throw new Error("Malformed token");
  const unsigned = `${header}.${payload}`;
  const expected = crypto
    .createHmac("sha256", process.env.JWT_SECRET)
    .update(unsigned)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

  if (signature.length !== expected.length) {
    throw new Error("Invalid token signature");
  }

  if (!crypto.timingSafeEqual(Buffer.from(signature, "utf8"), Buffer.from(expected, "utf8"))) {
    throw new Error("Invalid token signature");
  }

  const parsed = JSON.parse(fromBase64Url(payload));
  if (parsed.exp && parsed.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("Token expired");
  }
  return parsed;
};

export const createUsernameFromIdentity = (value = "") =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24) || `buzz_${crypto.randomBytes(4).toString("hex")}`;
