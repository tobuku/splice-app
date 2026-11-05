import Dexie, { type Table } from 'dexie';
import type {
  Job,
  Cable,
  SpliceCase,
  ResolvedSplicePlan,
  AuditEvent,
  User,
  ProjectMember,
  WorkAssignment,
} from '@splice/domain';

export class SpliceDatabase extends Dexie {
  jobs!: Table<Job, string>;
  cables!: Table<Cable, string>;
  spliceCases!: Table<SpliceCase, string>;
  plans!: Table<ResolvedSplicePlan, string>;
  auditLog!: Table<AuditEvent, string>;
  users!: Table<User, string>;
  projectMembers!: Table<ProjectMember, string>;
  workAssignments!: Table<WorkAssignment, string>;

  constructor() {
    super('CableSplicePlanner');

    this.version(1).stores({
      jobs: 'id, status, updatedAt',
      cables: 'id, media, sheathId',
      spliceCases: 'id, jobId, operationType',
      plans: 'id, spliceCaseId, status',
      auditLog: 'id, timestamp, entityType, entityId',
    });

    this.version(2).stores({
      jobs: 'id, status, updatedAt',
      cables: 'id, media, sheathId',
      spliceCases: 'id, jobId, operationType',
      plans: 'id, spliceCaseId, status',
      auditLog: 'id, timestamp, entityType, entityId',
      users: 'id, name, role',
      projectMembers: 'id, projectId, userId, [projectId+userId]',
      workAssignments: 'id, projectId, spliceCaseId, userId, status, [spliceCaseId+userId]',
    });

    // Audit-log middleware: log every mutation
    this.use({
      stack: 'dbcore',
      name: 'auditLogger',
      create: (downlevelDatabase) => ({
        ...downlevelDatabase,
        table: (tableName) => {
          const downlevelTable = downlevelDatabase.table(tableName);

          if (tableName === 'auditLog') return downlevelTable;

          return {
            ...downlevelTable,
            mutate: async (req) => {
              const result = await downlevelTable.mutate(req);

              // Log the mutation asynchronously (don't block the write)
              try {
                const reqAny = req as unknown as Record<string, unknown>;
                const keys = reqAny.keys as string[] | undefined;
                const values = reqAny.values as Array<{ id?: string }> | undefined;
                const event: AuditEvent = {
                  id: crypto.randomUUID(),
                  timestamp: new Date().toISOString(),
                  actorId: 'local-user',
                  actorRole: 'splicer',
                  entityType: tableName,
                  entityId: String(keys?.[0] ?? values?.[0]?.id ?? 'unknown'),
                  action: req.type,
                };
                await downlevelDatabase.table('auditLog').mutate({
                  type: 'add',
                  values: [event],
                  trans: req.trans,
                });
              } catch {
                // Audit logging must not break the app
              }

              return result;
            },
          };
        },
      }),
    });
  }
}

export const db = new SpliceDatabase();
