async function clearCache() {
  if (!confirm('Are you sure you want to clear all cache entries?')) return;

  try {
    const res = await fetch('/admin/cache', { method: 'DELETE' });
    if (res.ok) {
      const data = await res.json();
      alert(`Cleared ${data.cleared} cache entries`);
      location.reload();
    } else {
      alert('Failed to clear cache');
    }
  } catch (e) {
    console.error('Failed to clear cache', e);
    alert('Failed to clear cache');
  }
}
