// Script to list available Gemini models
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI('AIzaSyA6O_BkHGsqi4A0nO6eI8vh8HMgzUzPIRA');

async function listModels() {
  try {
    // Wait, @google/generative-ai doesn't have a listModels method easily exposed,
    // let's just try a few common model names
    const commonModels = [
      'gemini-2.0-flash-exp',
      'gemini-1.5-flash',
      'gemini-1.5-flash-8b',
      'gemini-1.5-pro',
      'gemini-1.0-pro'
    ];

    console.log('Trying common models...');
    for (const modelName of commonModels) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        console.log(`✓ Testing model: ${modelName}`);
        const result = await model.generateContent('Hi!');
        console.log(`  - Works! Response: ${result.response.text().substring(0, 50)}...`);
      } catch (e) {
        console.log(`✗ Model ${modelName} failed:`, e.message);
      }
    }
  } catch (e) {
    console.error('Error:', e);
  }
}

listModels();
