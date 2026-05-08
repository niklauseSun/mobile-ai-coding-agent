import type {
  AiReviewRecommendation,
  AiReviewResult,
  AiReviewRiskLevel,
  ReviewFindingSeverity,
} from '@/types';

import type { AiProviderAdapter, ReviewMergeRequestDiffInput } from './AiProviderAdapter';

export type OpenAICompatibleProviderConfig = {
  baseUrl: string;
  model: string;
  getApiKey: () => Promise<string | null>;
};

type ChatCompletionResponse = {
  choices?: {
    message?: {
      content?: string | null;
    };
  }[];
};

type ReviewResponsePayload = {
  summary?: string;
  riskLevel?: AiReviewRiskLevel;
  recommendation?: AiReviewRecommendation;
  isApprovedSuggestion?: boolean;
  findings?: {
    filePath?: string;
    lineNumber?: number;
    title?: string;
    message?: string;
    severity?: ReviewFindingSeverity;
    suggestedChange?: string;
  }[];
};

export class OpenAICompatibleProvider implements AiProviderAdapter {
  readonly type = 'openai';
  readonly label = 'OpenAI-compatible';
  readonly capabilities = {
    supportsMergeRequestReview: true,
    supportsMobileCodeGeneration: false,
  };

  private readonly baseUrl: string;
  private readonly model: string;
  private readonly getApiKey: () => Promise<string | null>;

  constructor(config: OpenAICompatibleProviderConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.model = config.model;
    this.getApiKey = config.getApiKey;
  }

  async reviewMergeRequestDiff(
    input: ReviewMergeRequestDiffInput,
  ): Promise<AiReviewResult> {
    const apiKey = await this.getApiKey();

    if (!apiKey) {
      throw new Error('AI provider API key is not configured.');
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'You are a careful code reviewer. Return only valid JSON with summary, riskLevel, recommendation, and findings.',
          },
          {
            role: 'user',
            content: buildReviewPrompt(input),
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`AI provider request failed with status ${response.status}.`);
    }

    const payload = (await response.json()) as ChatCompletionResponse;
    const content = payload.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('AI provider returned an empty review response.');
    }

    const review = parseReviewResponse(content);
    const now = new Date().toISOString();

    return {
      id: `ai-review-${input.mergeRequest.id}-${Date.now()}`,
      taskId: `review-${input.mergeRequest.id}`,
      repositoryId: input.repository.id,
      mergeRequestId: input.mergeRequest.id,
      summary: review.summary || 'AI review completed.',
      riskLevel: normalizeRiskLevel(review.riskLevel),
      recommendation: normalizeRecommendation(review.recommendation),
      isApprovedSuggestion: review.isApprovedSuggestion,
      findings: (review.findings ?? []).map((finding, index) => ({
        id: `finding-${input.mergeRequest.id}-${index}`,
        filePath: finding.filePath || 'unknown',
        lineNumber: finding.lineNumber,
        title: finding.title || 'Review finding',
        message: finding.message || '',
        severity: normalizeSeverity(finding.severity),
        suggestedChange: finding.suggestedChange,
      })),
      createdAt: now,
    };
  }
}

function buildReviewPrompt(input: ReviewMergeRequestDiffInput) {
  const files = input.diffFiles
    .map((file) =>
      [
        `File: ${file.path}`,
        `Status: ${file.status}`,
        `Changes: +${file.additions} -${file.deletions}`,
        file.patch ? `Patch:\n${file.patch}` : 'Patch unavailable.',
      ].join('\n'),
    )
    .join('\n\n');

  return [
    'Review this merge request diff for correctness, bugs, security risks, and missing tests.',
    'Return JSON in this shape:',
    '{"summary":"string","riskLevel":"low|medium|high","recommendation":"approve|approve_with_comments|request_changes","isApprovedSuggestion":boolean,"findings":[{"filePath":"string","lineNumber":number,"title":"string","message":"string","severity":"info|warning|error","suggestedChange":"string"}]}',
    `Repository: ${input.repository.fullName}`,
    `Merge request: #${input.mergeRequest.number} ${input.mergeRequest.title}`,
    `Target branch: ${input.mergeRequest.targetBranch.name}`,
    `Source branch: ${input.mergeRequest.sourceBranch.name}`,
    `Diff:\n${files}`,
  ].join('\n\n');
}

function parseReviewResponse(content: string): ReviewResponsePayload {
  try {
    return JSON.parse(content) as ReviewResponsePayload;
  } catch {
    return {
      summary: content,
      findings: [],
      isApprovedSuggestion: false,
    };
  }
}

function normalizeSeverity(severity?: string): ReviewFindingSeverity {
  if (severity === 'info' || severity === 'warning' || severity === 'error') {
    return severity;
  }

  return 'warning';
}

function normalizeRiskLevel(riskLevel?: string): AiReviewRiskLevel {
  if (riskLevel === 'low' || riskLevel === 'medium' || riskLevel === 'high') {
    return riskLevel;
  }

  return 'medium';
}

function normalizeRecommendation(recommendation?: string): AiReviewRecommendation {
  if (
    recommendation === 'approve' ||
    recommendation === 'approve_with_comments' ||
    recommendation === 'request_changes'
  ) {
    return recommendation;
  }

  return 'approve_with_comments';
}
