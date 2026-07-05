import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    console.log('Chat API request received');
    const { message } = await request.json();
    console.log('Message:', message);

    const SYSTEM_PROMPT = `Eres un asistente virtual del sistema de horarios de la UNT. Tu objetivo es responder preguntas claramente sobre el sistema de horarios. El sistema permite:
- Gestionar docentes, cursos, ciclos y aulas
- Crear y programar horarios
- Gestionar disponibilidad de docentes y ambientes
- Generar reportes y exportar datos
- Gestionar carga horaria lectiva y no lectiva

Responde en español, de manera clara y concisa.`;

    console.log('Sending prompt to Groq...');
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: message }
      ],
      model: 'llama-3.3-70b-versatile',
    });

    const text = chatCompletion.choices[0]?.message?.content || '';
    console.log('Groq response:', text);

    return NextResponse.json({ text });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json({ 
      error: 'Failed to get chat response', 
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}
