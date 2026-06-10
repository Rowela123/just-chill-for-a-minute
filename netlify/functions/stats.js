exports.handler = async function (event) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Missing Supabase environment variables.'
      })
    };
  }

  try {
    if (event.httpMethod === 'GET') {
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/chill_stats?id=eq.1&select=starts,fails,completes`,
        {
          method: 'GET',
          headers: {
            apikey: SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const data = await response.json();

      if (!response.ok) {
        return {
          statusCode: response.status,
          headers,
          body: JSON.stringify({
            error: 'Supabase GET failed.',
            details: data
          })
        };
      }

      const stats = Array.isArray(data) ? data[0] : data;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(formatStats(stats))
      };
    }

    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const eventType = body.eventType;

      if (!['start', 'fail', 'complete'].includes(eventType)) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            error: 'Invalid event type.'
          })
        };
      }

      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/rpc/increment_chill_stat`,
        {
          method: 'POST',
          headers: {
            apikey: SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            event_type: eventType
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        return {
          statusCode: response.status,
          headers,
          body: JSON.stringify({
            error: 'Supabase RPC failed.',
            eventType: eventType,
            details: data
          })
        };
      }

      const stats = Array.isArray(data) ? data[0] : data;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(formatStats(stats))
      };
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({
        error: 'Method not allowed.'
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error.message
      })
    };
  }
};

function formatStats(stats) {
  const starts = Number(stats?.starts || 0);
  const fails = Number(stats?.fails || 0);
  const completes = Number(stats?.completes || 0);
  const finishedAttempts = fails + completes;

  const failRate = finishedAttempts > 0
    ? Math.round((fails / finishedAttempts) * 100)
    : 0;

  return {
    starts,
    fails,
    completes,
    failRate
  };
}
