import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

interface GeneratorPayload {
  familyName: string;
  seriesName: string;
  episodeName: string;
  episodeObjective: string;
  learningObjectives: string[];
  difficultyLevel: string;
  trainingFormat: string;
  sampleCount: number;
  customFocus?: string;
}

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.post('/api/data-generator', async (req, res) => {
    const body = req.body as Partial<GeneratorPayload>;

    if (
      !body.episodeName ||
      !body.familyName ||
      !body.trainingFormat ||
      !body.difficultyLevel
    ) {
      res.status(400).json({
        error: 'Missing required fields: familyName, episodeName, difficultyLevel, and trainingFormat are required.',
      });
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: 'GEMINI_API_KEY is not configured. Please verify your API key in Settings > Secrets.',
      });
      return;
    }

    const count = Math.min(5, Math.max(1, Number(body.sampleCount) || 3));
    const objectivesList = Array.isArray(body.learningObjectives)
      ? body.learningObjectives.slice(0, 10).join('; ')
      : '';

    const systemInstruction = [
      'You are the ThinkNet Data Research Agent operating inside the ThinkNet Data Engineering & Training Data Exporter pipeline.',
      'Generate rigorous, technically accurate synthetic training samples tailored to the requested ThinkNet Environment Family, Episode, Difficulty Level, and Training Format.',
      'Never include vague filler or generic chatbot banter. Make every task concrete, domain-authentic, and verifiable.',
      'For Verifiable Reward (RLVR) format, include deterministic verification criteria (e.g., unit tests, mathematical checks, geometric constraints, or state invariants).',
      'For Preference Pair (DPO) format, make the primaryOutput the high-rigor chosen trajectory and secondaryOutput the realistic flawed/rejected trajectory with explicit failure diagnostics in verificationNotes.',
      'For SFT Trajectory format, include step-by-step reasoning and tool/environment execution steps in primaryOutput and verification checks in verificationNotes.',
      'For Reasoning Distillation format, provide detailed teacher reasoning in primaryOutput and compact student target output in secondaryOutput.',
    ].join(' ');

    const prompt = [
      `Environment Family: ${body.familyName}`,
      `Series / Domain: ${body.seriesName || 'Core Series'}`,
      `Episode: ${body.episodeName}`,
      `Episode Objective: ${body.episodeObjective || 'Develop domain capability.'}`,
      objectivesList ? `Learning Objectives: ${objectivesList}` : '',
      `Target Difficulty Level: ${body.difficultyLevel}`,
      `Target Training Format: ${body.trainingFormat}`,
      body.customFocus ? `Additional Research Focus: ${body.customFocus}` : '',
      `Generate exactly ${count} distinct, non-overlapping training samples.`,
    ]
      .filter(Boolean)
      .join('\n');

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              curriculumSummary: {
                type: Type.STRING,
                description: 'Brief summary of how these samples target the selected episode and difficulty tier.',
              },
              contaminationSafeguard: {
                type: Type.STRING,
                description: 'Note on avoiding benchmark contamination and ensuring synthetic diversity.',
              },
              samples: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    sampleId: { type: Type.STRING },
                    taskTitle: { type: Type.STRING },
                    inputPrompt: { type: Type.STRING },
                    expectedToolsOrContext: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                    primaryOutput: {
                      type: Type.STRING,
                      description: 'Chosen trajectory, SFT response, RLVR reference solution, or teacher trace.',
                    },
                    secondaryOutput: {
                      type: Type.STRING,
                      description: 'Rejected comparison output (DPO), compact student output (Distillation), or edge-case variant.',
                    },
                    verificationCriteria: {
                      type: Type.STRING,
                      description: 'Objective verification method or deterministic reward check.',
                    },
                    verificationNotes: {
                      type: Type.STRING,
                      description: 'Quality scoring criteria and common failure mode notes.',
                    },
                    qualityScoreEstimate: {
                      type: Type.NUMBER,
                      description: 'Estimated synthetic rubric clarity score from 0.0 to 1.0.',
                    },
                  },
                  required: [
                    'sampleId',
                    'taskTitle',
                    'inputPrompt',
                    'expectedToolsOrContext',
                    'primaryOutput',
                    'verificationCriteria',
                    'verificationNotes',
                    'qualityScoreEstimate',
                  ],
                },
              },
            },
            required: ['curriculumSummary', 'contaminationSafeguard', 'samples'],
          },
        },
      });

      const rawText = (response.text ?? '{}').trim();
      const parsed = JSON.parse(rawText);
      res.json({
        generatedAt: new Date().toISOString(),
        model: 'gemini-4-hydrogen',
        metadata: {
          familyName: body.familyName,
          seriesName: body.seriesName || '',
          episodeName: body.episodeName,
          difficultyLevel: body.difficultyLevel,
          trainingFormat: body.trainingFormat,
        },
        ...parsed,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to generate synthetic data samples.';
      const status = message.includes('403') || message.includes('PERMISSION_DENIED')
        ? 403
        : message.includes('429') || message.includes('RESOURCE_EXHAUSTED')
          ? 429
          : 500;
      res.status(status).json({ error: message });
    }
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexHtml = path.join(distDir, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send('Production build not found.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ThinkNet server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
