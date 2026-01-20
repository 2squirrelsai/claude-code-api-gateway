async function retryJob(jobId) {
  try {
    const res = await fetch(`/admin/queue/${jobId}/retry`, { method: 'POST' });
    if (res.ok) {
      location.reload();
    } else {
      alert('Failed to retry job');
    }
  } catch (e) {
    console.error('Failed to retry job', e);
    alert('Failed to retry job');
  }
}

async function removeJob(jobId) {
  if (!confirm('Are you sure you want to remove this job?')) return;

  try {
    const res = await fetch(`/admin/queue/${jobId}`, { method: 'DELETE' });
    if (res.ok) {
      location.reload();
    } else {
      alert('Failed to remove job');
    }
  } catch (e) {
    console.error('Failed to remove job', e);
    alert('Failed to remove job');
  }
}
