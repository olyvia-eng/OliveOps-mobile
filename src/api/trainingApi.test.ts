import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { completeTraining, loadMyTraining, loadMyTrainingDetail, loadMyTrainingHistory } from '@/api/trainingApi';

jest.mock('@/config/env', () => ({ ENV: { apiBaseUrl: 'https://app.oliveops.ca' } }));

function mockResponse(body: unknown) {
  return { ok: true, status: 200, json: jest.fn().mockResolvedValue(body) } as any;
}

describe('trainingApi', () => {
  afterEach(() => jest.restoreAllMocks());

  it('uses the documented employee list, detail, and history actions', async () => {
    const fetchMock = jest.spyOn(global, 'fetch' as any)
      .mockResolvedValueOnce(mockResponse({ ok: true, assignments: [], attentionCount: 0 }))
      .mockResolvedValueOnce(mockResponse({ ok: true, assignment: {}, version: {} }))
      .mockResolvedValueOnce(mockResponse({ ok: true, completions: [] }));

    await loadMyTraining('token-1');
    await loadMyTrainingDetail('assignment/a', 'token-1');
    await loadMyTrainingHistory('token-1');

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      'https://app.oliveops.ca/api/training?action=my-list',
      'https://app.oliveops.ca/api/training?action=my-detail&assignmentId=assignment%2Fa',
      'https://app.oliveops.ca/api/training?action=my-history',
    ]);
  });

  it('submits only the documented completion fields', async () => {
    const fetchMock = jest.spyOn(global, 'fetch' as any).mockResolvedValue(mockResponse({
      ok: true,
      completion: { id: 'completion-1' },
      replayed: false,
    }));

    await completeTraining({
      assignmentId: 'assignment-1',
      submissionId: 'training-attempt-1',
      checklistResponses: [{ itemId: 'item-1', checked: true }],
      acknowledged: true,
    }, 'token-1');

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(fetchMock.mock.calls[0][0]).toBe('https://app.oliveops.ca/api/training?action=complete');
    expect(body).toEqual({
      assignmentId: 'assignment-1',
      submissionId: 'training-attempt-1',
      checklistResponses: [{ itemId: 'item-1', checked: true }],
      acknowledged: true,
    });
    expect(body).not.toHaveProperty('businessId');
    expect(body).not.toHaveProperty('employeeId');
  });

  it('shares simultaneous Training list requests but permits a forced refresh', async () => {
    let resolveFetch!: (response: any) => void;
    const pending = new Promise<any>((resolve) => { resolveFetch = resolve; });
    const fetchMock = jest.spyOn(global, 'fetch' as any)
      .mockReturnValueOnce(pending)
      .mockResolvedValueOnce(mockResponse({ ok: true, assignments: [], attentionCount: 0 }));

    const first = loadMyTraining('shared-token');
    const second = loadMyTraining('shared-token');
    expect(first).toBe(second);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    resolveFetch(mockResponse({ ok: true, assignments: [], attentionCount: 0 }));
    await Promise.all([first, second]);

    await loadMyTraining('shared-token', { force: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});