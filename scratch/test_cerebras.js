import fetch from 'node-fetch';

const apiKey = 'csk-md8vyycf4emykcktmk4c6m52rhc6fefnyk2pm4pfmwpv4e4t';

async function testModel(model) {
  const start = Date.now();
  try {
    const response = await fetch('https://api.cerebras.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: 'Say hello in 5 words.' }],
        max_tokens: 15,
      }),
    });
    const status = response.status;
    const data = await response.json();
    const elapsed = Date.now() - start;
    console.log(`Model: ${model} | Status: ${status} | Time: ${elapsed}ms | Reply: ${data.choices?.[0]?.message?.content || JSON.stringify(data)}`);
  } catch (err) {
    console.error(`Model: ${model} | Error: ${err.message}`);
  }
}

async function run() {
  await testModel('gemma-4-31b');
  await testModel('zai-glm-4.7');
  await testModel('gpt-oss-120b');
}

run();
