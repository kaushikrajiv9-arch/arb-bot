import express, { type Express, type Request, type Response } from "express";
import cors from "cors";
import https from "https";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import pinoHttp from "pino-http";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { existsSync, readdirSync } from "fs";
import router from "./routes";
import { logger } from "./lib/logger";
import { setAlpacaCredentials, getAlpacaCredentials, PAPER_HOST, DATA_HOST } from "./lib/alpacaFeed";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (_req, res) => res.redirect("/api/"));

// Debug route — shows path resolution on the running server
app.get("/api/_debug", (_req, res) => {
  const p1 = join(__dirname, "public");
  const p2 = new URL("./public", import.meta.url).pathname;
  const p3 = join(process.cwd(), "public");
  const p4 = join(process.cwd(), "dist", "public");
  const check = (p: string) => ({ path: p, exists: existsSync(p), files: existsSync(p) ? readdirSync(p) : [] });
  res.json({ __dirname, cwd: process.cwd(), p1: check(p1), p2: check(p2), p3: check(p3), p4: check(p4) });
});

// Serve static files — try two path strategies for reliability across environments
const publicDir = join(__dirname, "public");
const publicDirAlt = new URL("./public", import.meta.url).pathname;
const resolvedPublic = existsSync(publicDir) ? publicDir : existsSync(publicDirAlt) ? publicDirAlt : join(process.cwd(), "dist", "public");

app.use("/api", express.static(resolvedPublic));

// Explicit fallback routes for HTML pages (belt-and-suspenders)
const serveHtml = (file: string) => (_req: Request, res: Response) => {
  const fp = join(resolvedPublic, file);
  if (existsSync(fp)) { res.sendFile(fp); } else { res.status(404).send("Not found: " + fp); }
};
app.get("/api/",                    serveHtml("index.html"));
app.get("/api/index.html",          serveHtml("index.html"));
app.get("/api/stock.html",          serveHtml("stock.html"));
app.get("/api/alphawire",           (_req, res) => res.redirect("/api/alphawire/"));
app.get("/api/alphawire/",          serveHtml("alphawire/index.html"));
app.get("/api/alphawire/index.html",serveHtml("alphawire/index.html"));

// ── Coinbase Advanced Trade proxy ─────────────────────────────────────────────
// Supports both:
//   • Cloud API Keys  → secret is a PEM EC private key, signed with ES256 JWT
//   • Legacy API Keys → secret is a hex string, signed with HMAC-SHA256
app.all("/api/coinbase/{*path}", (req: Request, res: Response) => {
  const cbPath    = req.url.replace("/api/coinbase", "");
  const apiKey    = req.headers["x-cb-api-key"]    as string | undefined;
  const apiSecret = req.headers["x-cb-api-secret"] as string | undefined;

  const bodyStr =
    req.body && Object.keys(req.body).length > 0
      ? JSON.stringify(req.body)
      : "";

  const forwardHeaders: Record<string, string | string[] | undefined> = {
    ...req.headers,
    host: "api.coinbase.com",
  };

  delete forwardHeaders["x-cb-api-key"];
  delete forwardHeaders["x-cb-api-secret"];

  if (apiKey && apiSecret) {
    // Detect Cloud API Key: secret starts with PEM header OR key name contains '/'
    const isCloudKey =
      apiSecret.trim().startsWith("-----BEGIN") || apiKey.includes("/");

    if (isCloudKey) {
      // JWT authentication for Cloud API Keys (ES256)
      try {
        const pemKey = apiSecret.replace(/\\n/g, "\n"); // un-escape newlines if needed
        const now = Math.floor(Date.now() / 1000);
        const uri = `${req.method.toUpperCase()} api.coinbase.com${cbPath}`;
        const token = jwt.sign(
          {
            sub: apiKey,
            iss: "cdp",
            nbf: now,
            exp: now + 120,
            uri,
          },
          pemKey,
          {
            algorithm: "ES256",
            header: { alg: "ES256", kid: apiKey },
          } as jwt.SignOptions,
        );
        forwardHeaders["Authorization"] = `Bearer ${token}`;
      } catch (err) {
        logger.error({ err }, "Failed to sign Coinbase JWT");
        res.status(401).json({ error: "Invalid Cloud API Key — check your PEM private key" });
        return;
      }
    } else {
      // Legacy HMAC-SHA256 authentication
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const message   = timestamp + req.method.toUpperCase() + cbPath + bodyStr;
      const signature = crypto
        .createHmac("sha256", apiSecret)
        .update(message)
        .digest("hex");

      forwardHeaders["CB-ACCESS-KEY"]       = apiKey;
      forwardHeaders["CB-ACCESS-SIGN"]      = signature;
      forwardHeaders["CB-ACCESS-TIMESTAMP"] = timestamp;
    }
  }

  if (bodyStr) {
    forwardHeaders["content-type"]   = "application/json";
    forwardHeaders["content-length"] = Buffer.byteLength(bodyStr).toString();
  }

  const options: https.RequestOptions = {
    hostname: "api.coinbase.com",
    path: cbPath,
    method: req.method,
    headers: forwardHeaders,
  };

  const proxy = https.request(options, (r) => {
    res.writeHead(r.statusCode ?? 502, r.headers as Record<string, string>);
    r.pipe(res);
  });

  proxy.on("error", (err) => {
    logger.error({ err }, "Coinbase proxy error");
    res.status(502).json({ error: "Proxy request failed" });
  });

  if (bodyStr) {
    proxy.write(bodyStr);
    proxy.end();
  } else {
    req.pipe(proxy);
  }
});

// ── Kraken REST proxy (HMAC-SHA512) ─────────────────────────────────────────
app.all("/api/kraken/{*path}", (req: Request, res: Response) => {
  const krPath    = req.url.replace("/api/kraken", "");
  const apiKey    = req.headers["x-kr-api-key"]    as string | undefined;
  const apiSecret = req.headers["x-kr-api-secret"] as string | undefined;

  const bodyObj: Record<string, string> = req.body ?? {};
  const postdata = new URLSearchParams(bodyObj).toString();

  const forwardHeaders: Record<string, string> = {
    host: "api.kraken.com",
    "user-agent": "arb-bot/1.0",
  };

  if (postdata) {
    forwardHeaders["content-type"]   = "application/x-www-form-urlencoded";
    forwardHeaders["content-length"] = Buffer.byteLength(postdata).toString();
  }

  if (apiKey && apiSecret && bodyObj.nonce) {
    const sha256Hash = crypto
      .createHash("sha256")
      .update(bodyObj.nonce + postdata)
      .digest();
    const message = Buffer.concat([Buffer.from(krPath), sha256Hash]);
    const signature = crypto
      .createHmac("sha512", Buffer.from(apiSecret, "base64"))
      .update(message)
      .digest("base64");

    forwardHeaders["API-Key"]  = apiKey;
    forwardHeaders["API-Sign"] = signature;
  }

  const options: https.RequestOptions = {
    hostname: "api.kraken.com",
    path: krPath,
    method: req.method,
    headers: forwardHeaders,
  };

  const proxy = https.request(options, (r) => {
    res.writeHead(r.statusCode ?? 502, r.headers as Record<string, string>);
    r.pipe(res);
  });

  proxy.on("error", (err) => {
    logger.error({ err }, "Kraken proxy error");
    res.status(502).json({ error: "Kraken proxy request failed" });
  });

  if (postdata) {
    proxy.write(postdata);
    proxy.end();
  } else {
    req.pipe(proxy);
  }
});

// ── OKX REST proxy (HMAC-SHA256) ──────────────────────────────────────────────
// Signs every request with OK-ACCESS-KEY / SIGN / TIMESTAMP / PASSPHRASE headers
app.all("/api/okx-private/{*path}", (req: Request, res: Response) => {
  const okxPath   = req.url.replace("/api/okx-private", "");
  const apiKey     = req.headers["x-okx-api-key"]     as string | undefined;
  const apiSecret  = req.headers["x-okx-api-secret"]  as string | undefined;
  const passphrase = req.headers["x-okx-passphrase"]  as string | undefined;

  const bodyStr =
    req.body && Object.keys(req.body).length > 0
      ? JSON.stringify(req.body)
      : "";

  const timestamp = new Date().toISOString();
  const method    = req.method.toUpperCase();

  const forwardHeaders: Record<string, string> = {
    host: "us.okx.com",
    "content-type": "application/json",
    "user-agent": "arb-bot/1.0",
  };

  if (apiKey && apiSecret && passphrase) {
    const message   = timestamp + method + okxPath + bodyStr;
    const signature = crypto
      .createHmac("sha256", apiSecret)
      .update(message)
      .digest("base64");

    forwardHeaders["OK-ACCESS-KEY"]        = apiKey;
    forwardHeaders["OK-ACCESS-SIGN"]       = signature;
    forwardHeaders["OK-ACCESS-TIMESTAMP"]  = timestamp;
    forwardHeaders["OK-ACCESS-PASSPHRASE"] = passphrase;
  }

  if (bodyStr) {
    forwardHeaders["content-length"] = Buffer.byteLength(bodyStr).toString();
  }

  const options: https.RequestOptions = {
    hostname: "us.okx.com",
    path:     okxPath,
    method,
    headers:  forwardHeaders,
  };

  const proxy = https.request(options, (r) => {
    res.writeHead(r.statusCode ?? 502, r.headers as Record<string, string>);
    r.pipe(res);
  });

  proxy.on("error", (err) => {
    logger.error({ err }, "OKX proxy error");
    res.status(502).json({ error: "OKX proxy request failed" });
  });

  if (bodyStr) {
    proxy.write(bodyStr);
    proxy.end();
  } else {
    proxy.end();
  }
});

app.use("/api", router);

// ── Alpaca Stock Bot ──────────────────────────────────────────────────────────
app.post("/api/stock/connect", (req: Request, res: Response) => {
  const { key, secret } = req.body as { key?: string; secret?: string };
  if (!key || !secret) { res.status(400).json({ error: "key and secret required" }); return; }
  // Validate credentials against Alpaca paper account before accepting
  const fwd = { "APCA-API-KEY-ID": key, "APCA-API-SECRET-KEY": secret, accept: "application/json", host: PAPER_HOST };
  const probe = https.request({ hostname: PAPER_HOST, path: "/v2/account", method: "GET", headers: fwd }, (r) => {
    let body = "";
    r.on("data", (c: Buffer) => { body += c.toString(); });
    r.on("end", () => {
      if (r.statusCode === 200) {
        setAlpacaCredentials(key, secret);
        let portfolioValue: string | undefined;
        try { portfolioValue = (JSON.parse(body) as { portfolio_value?: string }).portfolio_value; } catch {}
        res.json({ ok: true, portfolioValue });
      } else {
        let errMsg = `HTTP ${r.statusCode}`;
        try { errMsg = (JSON.parse(body) as { message?: string }).message ?? errMsg; } catch {}
        logger.warn({ errMsg }, "Alpaca connect validation failed");
        res.status(401).json({ ok: false, error: `Invalid Alpaca keys: ${errMsg}. Go to alpaca.markets → Paper Trading → API Keys and re-copy both values.` });
      }
    });
  });
  probe.on("error", (err) => res.status(502).json({ ok: false, error: `Could not reach Alpaca: ${(err as Error).message}` }));
  probe.end();
});

app.get("/api/stock/status", (_req, res) => {
  const { key } = getAlpacaCredentials();
  res.json({ connected: !!key, keyPrefix: key ? key.slice(0, 6) + "…" : null });
});

// Proxy Alpaca paper trading REST (orders, account, positions)
app.all("/api/alpaca-private/{*path}", (req: Request, res: Response) => {
  const alpacaPath = req.url.replace("/api/alpaca-private", "");
  const { key, secret } = getAlpacaCredentials();
  const apiKey    = (req.headers["x-alpaca-key"]    as string | undefined) || key;
  const apiSecret = (req.headers["x-alpaca-secret"] as string | undefined) || secret;

  const bodyStr = req.body && Object.keys(req.body).length > 0 ? JSON.stringify(req.body) : "";
  const fwd: Record<string, string> = {
    host:                  PAPER_HOST,
    "content-type":        "application/json",
    "APCA-API-KEY-ID":     apiKey,
    "APCA-API-SECRET-KEY": apiSecret,
    "accept":              "application/json",
  };
  if (bodyStr) fwd["content-length"] = Buffer.byteLength(bodyStr).toString();

  const proxy = https.request({ hostname: PAPER_HOST, path: alpacaPath, method: req.method.toUpperCase(), headers: fwd }, (r) => {
    const safeHeaders = { ...r.headers };
    delete safeHeaders["www-authenticate"]; // prevent iOS native auth dialog on 401
    res.writeHead(r.statusCode ?? 502, safeHeaders as Record<string, string>);
    r.pipe(res);
  });
  proxy.on("error", (err) => { logger.error({ err }, "Alpaca proxy error"); res.status(502).json({ error: "Alpaca proxy failed" }); });
  if (bodyStr) proxy.write(bodyStr);
  proxy.end();
});

// Proxy Alpaca market data REST (quotes, bars)
app.all("/api/alpaca-data/{*path}", (req: Request, res: Response) => {
  const dataPath = req.url.replace("/api/alpaca-data", "");
  const { key, secret } = getAlpacaCredentials();
  const apiKey    = (req.headers["x-alpaca-key"]    as string | undefined) || key;
  const apiSecret = (req.headers["x-alpaca-secret"] as string | undefined) || secret;

  const fwd: Record<string, string> = {
    host: DATA_HOST, "content-type": "application/json",
    "APCA-API-KEY-ID": apiKey, "APCA-API-SECRET-KEY": apiSecret, "accept": "application/json",
  };

  const proxy = https.request({ hostname: DATA_HOST, path: dataPath, method: req.method.toUpperCase(), headers: fwd }, (r) => {
    const safeHeaders = { ...r.headers };
    delete safeHeaders["www-authenticate"];
    res.writeHead(r.statusCode ?? 502, safeHeaders as Record<string, string>);
    r.pipe(res);
  });
  proxy.on("error", (err) => { logger.error({ err }, "Alpaca data proxy error"); res.status(502).json({ error: "Alpaca data proxy failed" }); });
  proxy.end();
});

export default app;
