import * as schema from "../schema";

type Row = Record<string, unknown>;
type Table = (typeof schema)[keyof typeof schema];
type SqlLike = { queryChunks?: unknown[] };
type QueryConfig = { where?: unknown };
type Condition = { key: string; op: "=" | "<="; value: unknown };

const tableKeys = new Map<unknown, (row: Row) => string>([
  [schema.adherenceStreaks, (row) => String(row.userId)],
  [schema.conversationMessages, (row) => String(row.userId)],
  [schema.customReminderTimes, (row) => String(row.userId)],
  [schema.exportBlobs, (row) => String(row.userId)],
  [schema.expiringKeys, (row) => String(row.key)],
  [schema.memories, (row) => `${row.userId}:${row.key}`],
  [schema.oneOffReminders, (row) => String(row.id)],
  [schema.onboardingStates, (row) => String(row.userId)],
  [schema.phoneMappings, (row) => String(row.encryptedPhone)],
  [schema.products, (row) => String(row.id)],
  [schema.reminderRunIds, (row) => String(row.userId)],
  [schema.routineEntries, (row) => String(row.id)],
  [schema.users, (row) => String(row.id)],
]);

function columnKey(dbName: string): string {
  return dbName.replace(/_([a-z])/g, (_, char: string) => char.toUpperCase());
}

function collectConditions(expr: unknown, out: Condition[] = []): Condition[] {
  const chunks = (expr as SqlLike | undefined)?.queryChunks;
  if (!chunks) return out;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i] as { name?: string; queryChunks?: unknown[] };
    if (chunk?.queryChunks) collectConditions(chunk, out);
    if (!chunk?.name) continue;

    const op = chunks[i + 1] as { value?: string[] } | undefined;
    const param = chunks[i + 2] as { value?: unknown } | undefined;
    const opText = op?.value?.join("") ?? "";
    if (param && "value" in param) {
      if (opText.includes("<="))
        out.push({ key: columnKey(chunk.name), op: "<=", value: param.value });
      else if (opText.includes("="))
        out.push({ key: columnKey(chunk.name), op: "=", value: param.value });
    }
  }

  return out;
}

function compareValues(left: unknown, right: unknown): number {
  const leftValue = left instanceof Date ? left.getTime() : left;
  const rightValue = right instanceof Date ? right.getTime() : right;
  if (typeof leftValue === "number" && typeof rightValue === "number")
    return leftValue - rightValue;
  return String(leftValue).localeCompare(String(rightValue));
}

function matches(row: Row, where?: unknown): boolean {
  return collectConditions(where).every((condition) => {
    if (condition.op === "<=") return compareValues(row[condition.key], condition.value) <= 0;
    return row[condition.key] === condition.value;
  });
}

function materialize(value: Row): Row {
  const out: Row = {};
  for (const [key, val] of Object.entries(value)) {
    out[key] = (val as SqlLike | undefined)?.queryChunks ? new Date() : val;
  }
  return out;
}

export function createFakeDb() {
  const stores = new Map<unknown, Map<string, Row>>();

  function storeFor(table: unknown): Map<string, Row> {
    let store = stores.get(table);
    if (!store) {
      store = new Map();
      stores.set(table, store);
    }
    return store;
  }

  function keyFor(table: unknown, row: Row): string {
    const getKey = tableKeys.get(table);
    if (!getKey) throw new Error("Unknown fake table");
    return getKey(row);
  }

  function findMany(table: Table, config?: QueryConfig): Row[] {
    const rows = Array.from(storeFor(table).values()).filter((row) => matches(row, config?.where));
    if (table === schema.products)
      rows.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
    if (table === schema.oneOffReminders)
      rows.sort((a, b) => String(a.sendAt).localeCompare(String(b.sendAt)));
    if (table === schema.routineEntries)
      rows.sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));
    return rows.map((row) => ({ ...row }));
  }

  function tableQuery(table: Table) {
    return {
      findFirst: async (config?: QueryConfig) => findMany(table, config)[0],
      findMany: async (config?: QueryConfig) => findMany(table, config),
    };
  }

  return {
    query: {
      adherenceStreaks: tableQuery(schema.adherenceStreaks),
      conversationMessages: tableQuery(schema.conversationMessages),
      customReminderTimes: tableQuery(schema.customReminderTimes),
      exportBlobs: tableQuery(schema.exportBlobs),
      expiringKeys: tableQuery(schema.expiringKeys),
      memories: tableQuery(schema.memories),
      oneOffReminders: tableQuery(schema.oneOffReminders),
      onboardingStates: tableQuery(schema.onboardingStates),
      phoneMappings: tableQuery(schema.phoneMappings),
      products: tableQuery(schema.products),
      reminderRunIds: tableQuery(schema.reminderRunIds),
      routineEntries: tableQuery(schema.routineEntries),
      users: tableQuery(schema.users),
    },
    insert(table: Table) {
      const builder = {
        _row: undefined as Row | undefined,
        _doNothing: false,
        values(row: Row) {
          builder._row = materialize(row);
          return builder;
        },
        onConflictDoUpdate(config: { set: Row }) {
          if (!builder._row) throw new Error("Missing insert row");
          const store = storeFor(table);
          const key = keyFor(table, builder._row);
          const existing = store.get(key);
          store.set(key, existing ? { ...existing, ...materialize(config.set) } : builder._row);
          return Promise.resolve([]);
        },
        onConflictDoNothing() {
          builder._doNothing = true;
          return builder;
        },
        returning(selection: Row) {
          if (!builder._row) throw new Error("Missing insert row");
          const store = storeFor(table);
          const key = keyFor(table, builder._row);
          if (builder._doNothing && store.has(key)) return Promise.resolve([]);
          store.set(key, builder._row);
          const selected = Object.fromEntries(
            Object.keys(selection).map((field) => [field, builder._row?.[field]]),
          );
          return Promise.resolve([selected]);
        },
      };
      return builder;
    },
    delete(table: Table) {
      return {
        where: async (where: unknown) => {
          const store = storeFor(table);
          for (const [key, row] of store.entries()) {
            if (matches(row, where)) store.delete(key);
          }
        },
      };
    },
    update(table: Table) {
      return {
        set: (updates: Row) => ({
          where: async (where: unknown) => {
            const store = storeFor(table);
            for (const [key, row] of store.entries()) {
              if (matches(row, where)) store.set(key, { ...row, ...materialize(updates) });
            }
          },
        }),
      };
    },
    rows(table: Table) {
      return Array.from(storeFor(table).values()).map((row) => ({ ...row }));
    },
  };
}
