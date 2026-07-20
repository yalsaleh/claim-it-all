import { createCorrelationId } from '@contractradar/shared';
import { toErrorResponse } from '@/server/errors';
import {
  approveConfigurationRevision,
  createAndSubmitConfigurationRevision,
  getApprovedConfiguration,
  requestConfigurationChanges,
  supersedeApprovedConfiguration,
} from '@/server/services/contracts';

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string; contractPackageId: string }> },
) {
  const correlationId = createCorrelationId();
  try {
    const { projectId, contractPackageId } = await context.params;
    const approved = await getApprovedConfiguration(projectId, contractPackageId);
    return Response.json(approved);
  } catch (error) {
    return toErrorResponse(error, correlationId);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string; contractPackageId: string }> },
) {
  const correlationId = createCorrelationId();
  try {
    const { projectId, contractPackageId } = await context.params;
    const body = (await request.json()) as {
      action?: string;
      revisionId?: string;
      summary?: string;
      rationale?: string;
    };
    if (body.action === 'submit') {
      const revision = await createAndSubmitConfigurationRevision(projectId, contractPackageId, {
        summary: body.summary,
      });
      return Response.json(revision, { status: 201 });
    }
    if (body.action === 'approve') {
      if (!body.revisionId) {
        return Response.json(
          { error: { code: 'VALIDATION_ERROR', message: 'revisionId required' } },
          { status: 400 },
        );
      }
      const approved = await approveConfigurationRevision(
        projectId,
        contractPackageId,
        body.revisionId,
      );
      return Response.json(approved);
    }
    if (body.action === 'request_changes') {
      if (!body.revisionId) {
        return Response.json(
          { error: { code: 'VALIDATION_ERROR', message: 'revisionId required' } },
          { status: 400 },
        );
      }
      const updated = await requestConfigurationChanges(
        projectId,
        contractPackageId,
        body.revisionId,
        { rationale: body.rationale },
      );
      return Response.json(updated);
    }
    if (body.action === 'supersede') {
      const result = await supersedeApprovedConfiguration(projectId, contractPackageId, {
        summary: body.summary,
      });
      return Response.json(result);
    }
    return Response.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'action must be submit, approve, request_changes, or supersede',
        },
      },
      { status: 400 },
    );
  } catch (error) {
    return toErrorResponse(error, correlationId);
  }
}
