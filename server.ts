import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import {
  checkRateLimit,
  computeAgronomicCuttingWindow,
  generateCryptographicReceiptSeal,
  optimizeRouteWith2Opt,
} from './src/utils/backendEngine';
import {
  calculateDualTierQuote,
  getWeatherForDate,
  sanitizeText,
} from './src/utils/lawnLogic';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // 1. Security & Hardening Middleware
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader(
      'Permissions-Policy',
      'geolocation=(self), camera=(self), microphone=(self)'
    );
    res.setHeader('X-XSS-Protection', '1; mode=block');

    if (req.path.startsWith('/api/')) {
      const clientIp =
        (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        req.socket.remoteAddress ||
        'local';
      const limit = checkRateLimit(clientIp, 90, 3);
      res.setHeader('X-RateLimit-Remaining', String(limit.remaining));
      if (!limit.allowed) {
        res.status(429).json({
          ok: false,
          error: 'Demasiadas solicitudes. Intentá nuevamente en unos segundos.',
        });
        return;
      }
    }
    next();
  });

  app.use(express.json({ limit: '2mb' }));

  // 2. API: Health & Security Audit Endpoint
  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'PastoPro Field Operations Engine',
      uptimeSec: Math.round(process.uptime()),
      security: {
        nosniff: true,
        rateLimiter: 'TokenBucket-Active',
        receiptSeal: 'FNV1a-64-Verified',
        routeSolver: '2-Opt-TSP',
      },
      timestamp: new Date().toISOString(),
    });
  });

  // 3. API: 2-Opt + Nearest-Neighbor TSP Route Optimization Engine
  app.post('/api/route/optimize', (req, res) => {
    try {
      const { baseLocation, jobs } = req.body || {};
      if (
        !baseLocation ||
        typeof baseLocation.lat !== 'number' ||
        typeof baseLocation.lng !== 'number' ||
        !Array.isArray(jobs)
      ) {
        res.status(400).json({
          ok: false,
          error: 'Parámetros de ruta inválidos: se requiere baseLocation y jobs.',
        });
        return;
      }
      const result = optimizeRouteWith2Opt(baseLocation, jobs);
      res.json({
        ok: true,
        ...result,
      });
    } catch (err: any) {
      res.status(500).json({
        ok: false,
        error: sanitizeText(String(err?.message || 'Error al optimizar ruta')),
      });
    }
  });

  // 4. API: Real-Time Agronomic Cutting Window & Weather Advisory
  app.get('/api/agronomy/advisory', (req, res) => {
    const dateStr = sanitizeText(
      String(req.query.date || new Date().toISOString().slice(0, 10)),
      20
    );
    const city = sanitizeText(
      String(req.query.city || 'Venado Tuerto, Santa Fe'),
      80
    );
    const weather = getWeatherForDate(dateStr, city);
    const advisory = computeAgronomicCuttingWindow(
      dateStr,
      city,
      weather.tempMax,
      weather.condition
    );
    res.json({
      ok: true,
      weather,
      advisory,
    });
  });

  // 5. API: Precision Agronomic Quote Calculator
  app.post('/api/quote/calculate', (req, res) => {
    try {
      const {
        areaSqm = 450,
        propertyType = 'Casa',
        grassCondition = 'Regular',
        includesBagging = false,
        extraTasksCount = 1,
        travelFee = 0,
        baseRatePerSqm = 65,
        minServicePrice = 15000,
      } = req.body || {};

      const quote = calculateDualTierQuote({
        areaSqm: Math.max(20, Math.min(50000, Number(areaSqm) || 450)),
        propertyType,
        grassCondition,
        includesBagging: Boolean(includesBagging),
        extraTasksCount: Math.max(0, Number(extraTasksCount) || 0),
        travelFee: Math.max(0, Number(travelFee) || 0),
        baseRatePerSqm: Math.max(10, Number(baseRatePerSqm) || 65),
        minServicePrice: Math.max(1000, Number(minServicePrice) || 15000),
      });

      res.json({
        ok: true,
        quote,
      });
    } catch (err: any) {
      res.status(400).json({
        ok: false,
        error: sanitizeText(String(err?.message || 'Error en cálculo')),
      });
    }
  });

  // 6. API: Cryptographic Receipt Seal Verification
  app.post('/api/receipts/verify', (req, res) => {
    const { invoiceId, clientName, amount, date } = req.body || {};
    if (!invoiceId || !clientName) {
      res.status(400).json({
        ok: false,
        error: 'Se requiere invoiceId y clientName para emitir sello.',
      });
      return;
    }
    const seal = generateCryptographicReceiptSeal({
      invoiceId: sanitizeText(String(invoiceId), 60),
      clientName: sanitizeText(String(clientName), 120),
      amount: Number(amount) || 0,
      date: sanitizeText(
        String(date || new Date().toISOString().slice(0, 10)),
        20
      ),
    });
    res.json({
      ok: true,
      seal,
    });
  });

  // 7. Vite Middleware (Dev) or Static Assets (Prod)
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*all', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(
      `[PastoPro Full-Stack Engine] Server running on http://0.0.0.0:${PORT}`
    );
  });
}

startServer();
