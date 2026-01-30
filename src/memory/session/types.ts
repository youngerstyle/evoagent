/**
 * Session Memory Types
 */

export interface SessionStats {
  totalSessions: number;
  activeSessions: number;
  archivedSessions: number;
  totalSize: number;
  oldestSession?: Date;
  newestSession?: Date;
}

export interface SessionFilter {
  userId?: string;
  status?: 'active' | 'archived' | 'pruned';
  createdAfter?: number;
  createdBefore?: number;
  minAgentRuns?: number;
  hasArtifacts?: boolean;
}
