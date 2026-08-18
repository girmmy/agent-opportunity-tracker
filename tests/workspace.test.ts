import { describe, expect, test } from 'vitest';
import { completeTask, sortTasks } from '@/lib/workspace';

describe('workspace tasks', () => {
  test('sorts overdue open work before future work', () => {
    expect(sortTasks([
      { id: 'future', title: 'Future', status: 'Open', priority: 'High', due_date: '2026-08-22' },
      { id: 'late', title: 'Late', status: 'Open', priority: 'Low', due_date: '2026-08-17' },
    ], '2026-08-18').map((task) => task.id)).toEqual(['late', 'future']);
  });

  test('records a completion timestamp', () => {
    expect(completeTask({ id: '1', title: 'Send', status: 'Open' }, '2026-08-18T14:00:00Z'))
      .toMatchObject({ status: 'Done', completed_at: '2026-08-18T14:00:00Z' });
  });
});
