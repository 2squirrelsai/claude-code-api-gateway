async function refreshStats() {
  try {
    const res = await fetch('/admin/api/stats');
    const data = await res.json();

    document.getElementById('waiting').textContent = data.queue.waiting;
    document.getElementById('active').textContent = data.queue.active;
    document.getElementById('completed').textContent = data.queue.completed;
    document.getElementById('failed').textContent = data.queue.failed;
    document.getElementById('cacheKeys').textContent = data.cache.totalKeys;
  } catch (e) {
    console.error('Failed to refresh stats', e);
  }
}

setInterval(refreshStats, 5000);
