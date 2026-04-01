export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API key not configured on server.' }), { status: 500 });
  }

  let body;
  try {
    body = await req.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Invalid request body.' }), { status: 400 });
  }

  if (!body || !body.messages) {
    return new Response(JSON.stringify({ error: 'Invalid request body — messages array missing.' }), { status: 400 });
  }

  // Strip internal metadata before forwarding to Anthropic
  const anthropicBody = { ...body };
  delete anthropicBody._employeeName;
  delete anthropicBody._rowCount;

  // Enable streaming
  anthropicBody.stream = true;

  const employeeName = body._employeeName || 'unknown';
  const rowCount = body._rowCount || 'unknown';
  console.log(`Generating report for: ${employeeName} | rows: ${rowCount}`);

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(anthropicBody),
    });

    if (!upstream.ok) {
      const errText = await upstream.text();
      console.error(`Anthropic error ${upstream.status}: ${errText}`);
      return new Response(JSON.stringify({ error: errText }), { status: upstream.status });
    }

    // Stream Anthropic's SSE response back to the client as plain text chunks
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const stream = new ReadableStream({
      async start(controller) {
        const reader = upstream.body.getReader();
        let fullText = '';

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const data = line.slice(6).trim();
              if (data === '[DONE]') continue;

              try {
                const parsed = JSON.parse(data);

                // Extract text delta from Anthropic's streaming format
                if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
                  const text = parsed.delta.text || '';
                  fullText += text;
                  // Send raw text chunk to client
                  controller.enqueue(encoder.encode(text));
                }

                // On stream end, we're done
                if (parsed.type === 'message_stop') {
                  console.log(`Stream complete. Total chars: ${fullText.length}`);
                }

                // Handle errors in stream
                if (parsed.type === 'error') {
                  console.error('Stream error:', parsed.error);
                  controller.enqueue(encoder.encode(`__STREAM_ERROR__:${JSON.stringify(parsed.error)}`));
                }
              } catch (_) {
                // Skip unparseable SSE lines
              }
            }
          }
        } catch (err) {
          console.error('Stream read error:', err.message);
          controller.enqueue(encoder.encode(`__STREAM_ERROR__:${err.message}`));
        } finally {
          controller.close();
        }
      }
    });

    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'X-Accel-Buffering': 'no',
        'Cache-Control': 'no-cache',
      },
    });

  } catch (err) {
    console.error('Unhandled error:', err.message);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
