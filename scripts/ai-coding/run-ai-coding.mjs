#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { applyPatchFile } from './apply-patch.mjs';
import { buildContext, writeContextFile } from './build-context.mjs';

const DEFAULT_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_MODEL = 'gpt-4.1';
const PATCH_PATH = process.env.AI_PATCH_PATH ?? '.ai-coding/generated.patch';

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function chatCompletionsEndpoint(baseUrl) {
  const trimmed = baseUrl.replace(/\/+$/, '');
  if (trimmed.endsWith('/chat/completions')) {
    return trimmed;
  }
  return `${trimmed}/chat/completions`;
}

function redact(value) {
  const apiKey = process.env.AI_PROVIDER_API_KEY;
  if (!apiKey) {
    return value;
  }
  return value.split(apiKey).join('[REDACTED_API_KEY]');
}

function extractAssistantText(responseJson) {
  const choice = responseJson.choices?.[0];
  const content = choice?.message?.content ?? choice?.text;

  if (typeof content !== 'string' || content.trim().length === 0) {
    throw new Error('AI provider response did not include assistant content.');
  }

  return content;
}

function extractGitPatch(responseText) {
  const withoutFences = responseText
    .replace(/^```(?:diff|patch)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
  const start = withoutFences.indexOf('diff --git ');

  if (start === -1) {
    throw new Error('AI provider did not return a git unified diff.');
  }

  return `${withoutFences.slice(start).trimEnd()}\n`;
}

async function requestPatch({ apiKey, baseUrl, model, context }) {
  const endpoint = chatCompletionsEndpoint(baseUrl);
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: Number(process.env.AI_PROVIDER_TEMPERATURE ?? 0.2),
      messages: [
        {
          role: 'system',
          content: [
            'You are a repository automation coding agent running in GitHub Actions.',
            'Return only a git unified diff that can be applied with git apply.',
            'Do not include markdown fences, prose, logs, or explanations.',
            'Keep the change tightly scoped to the task.',
            'Do not create credentials, tokens, API keys, or secret files.',
            'Do not modify files outside the repository context.',
          ].join('\n'),
        },
        {
          role: 'user',
          content: JSON.stringify(context),
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = redact(await response.text());
    throw new Error(`AI provider request failed with ${response.status}: ${errorText.slice(0, 800)}`);
  }

  return extractAssistantText(await response.json());
}

export async function runAiCoding() {
  const apiKey = requiredEnv('AI_PROVIDER_API_KEY');
  const baseUrl = process.env.AI_PROVIDER_BASE_URL || DEFAULT_BASE_URL;
  const model = process.env.AI_PROVIDER_MODEL || DEFAULT_MODEL;
  const context = buildContext();
  const contextPath = writeContextFile(context);

  console.log(`Built bounded AI context at ${contextPath}.`);

  const responseText = await requestPatch({ apiKey, baseUrl, model, context });
  const patch = extractGitPatch(responseText);

  mkdirSync(path.dirname(PATCH_PATH), { recursive: true });
  writeFileSync(PATCH_PATH, patch, 'utf8');
  console.log(`Wrote generated patch to ${PATCH_PATH}.`);

  applyPatchFile(PATCH_PATH);
  console.log('Applied generated patch.');
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  runAiCoding().catch((error) => {
    console.error(redact(error.message));
    process.exit(1);
  });
}
