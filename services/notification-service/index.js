import appModule from './dist/index.js';

const app =
  typeof appModule === 'function'
    ? appModule
    : typeof appModule?.default === 'function'
      ? appModule.default
      : appModule?.default?.default || appModule;

export default function handler(req, res) {
  if (typeof app === 'function') {
    return app(req, res);
  }
  if (typeof app?.handle === 'function') {
    return app.handle(req, res);
  }
  res.status(500).json({ error: 'Notification service failed to initialize' });
}
