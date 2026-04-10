export const trackActivity = async (eventId: number, actionType: 'view' | 'click' | 'register') => {
  try {
    const token = localStorage.getItem('token');
    if (!token) return; // Requirement: return if token doesn't exist
    
    // We do NOT use await when calling this from components to avoid blocking
    // but the function itself can be async.
    fetch('http://localhost:5000/activity', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ event_id: eventId, action_type: actionType })
    }).catch(err => console.error('Tracking broadcast failed:', err));

  } catch (err) {
    // Fail silently (console.log only)
    console.error('Activity Tracking Error:', err);
  }
};
