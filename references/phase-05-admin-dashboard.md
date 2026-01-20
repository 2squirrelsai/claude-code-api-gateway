# Phase 5: Admin Dashboard

> Load this file when working on: web UI, EJS templates, admin routes

## Files to Create

| File | Purpose |
|------|---------|
| `src/routes/admin.js` | Admin API and page routes |
| `src/views/dashboard.ejs` | Main dashboard template |
| `src/views/queue.ejs` | Queue management view |
| `src/views/cache.ejs` | Cache inspection view |
| `src/public/css/style.css` | Dashboard styles |
| `src/public/js/dashboard.js` | Auto-refresh logic |

## Fastify Plugins Required

```javascript
fastify.register(require('@fastify/static'), {
  root: path.join(__dirname, 'public'),
});
fastify.register(require('@fastify/view'), {
  engine: { ejs: require('ejs') },
  root: path.join(__dirname, 'views'),
});
```

## Authentication Pattern

Basic Auth via hook:
```javascript
fastify.addHook('onRequest', async (request, reply) => {
  const auth = request.headers.authorization;
  // Decode base64, compare credentials
  // Reply 401 if invalid
});
```

## Route Structure

| Route | Method | Purpose |
|-------|--------|---------|
| `/admin` | GET | Dashboard page |
| `/admin/queue` | GET | Queue management page |
| `/admin/queue/:id/retry` | POST | Retry failed job |
| `/admin/queue/:id` | DELETE | Remove job |
| `/admin/cache` | GET | Cache inspection page |
| `/admin/cache` | DELETE | Clear all cache |
| `/admin/api/stats` | GET | JSON stats for AJAX |

## Template Pattern

```html
<!-- dashboard.ejs -->
<main>
  <div class="stats-grid">
    <div class="stat-card">
      <h3>Queue</h3>
      <p>Waiting: <span id="waiting"><%= queueCounts.waiting %></span></p>
    </div>
  </div>
</main>
<script src="/js/dashboard.js"></script>
```

## Auto-Refresh Pattern

```javascript
async function refreshStats() {
  const res = await fetch('/admin/api/stats');
  const data = await res.json();
  document.getElementById('waiting').textContent = data.queue.waiting;
}
setInterval(refreshStats, 5000);
```

## Styling Guidelines

- Use CSS Grid for responsive layouts
- Card-based design for stats
- System font stack for consistency
- Subtle shadows for depth

## Validation Checklist

- [ ] Auth blocks unauthenticated requests
- [ ] Dashboard renders with live data
- [ ] Retry button works for failed jobs
- [ ] Clear cache removes all keys
- [ ] Stats refresh every 5 seconds
