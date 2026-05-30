import { write } from "bun";
import { parse } from "@std/csv";

const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
const path = `data/${yesterday}.csv`;
const indexPath = "data/index.csv";

interface IndexEntry {
  index: number;
  key: string;
  name: string;
  group: string;
  enabled: boolean;
}

interface EndpointResult {
  status: number;
  hostname: string;
  duration: number;
  conditionResults: {
    condition: string;
    success: boolean;
  }[];
  success: boolean;
  timestamp: string;
}

interface EndpointEntry {
  name: string;
  group: string;
  key: string;
  results: EndpointResult[];
}

function csvEscape(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

async function readIndexFile(): Promise<IndexEntry[]> {
  try {
    const content = await Bun.file(indexPath).text();
    if (!content) return [];
    const rows = parse(content, { skipFirstRow: true }) as Record<
      string,
      string
    >[];
    return rows.map((row) => ({
      index: Number((row.index ?? "0").trim()),
      key: (row.key ?? "").trim(),
      name: (row.name ?? "").trim(),
      group: (row.group ?? "").trim(),
      enabled: (row.enabled ?? "").trim().toLowerCase() !== "false",
    }));
  } catch {
    return [];
  }
}

async function writeIndexFile(entries: IndexEntry[]) {
  await write(
    indexPath,
    [
      "index,key,name,group,enabled",
      ...entries
        .slice()
        .sort((a, b) => a.index - b.index)
        .map((entry) =>
          [
            entry.index.toString(),
            csvEscape(entry.key),
            csvEscape(entry.name),
            csvEscape(entry.group),
            entry.enabled.toString(),
          ].join(","),
        ),
    ].join("\n") + "\n",
  );
}

const endpoints: EndpointEntry[] = [];
let page = 1;
while (true) {
  if (page > 100) throw new Error("Killswitch activated.");
  console.log(`Fetching page ${page}...`);
  const res = await fetch(
    `https://mowojang-status.pixelic.dev/api/v1/endpoints/statuses?page=${page}&pageSize=50`,
  );
  if (!res.ok) throw new Error("Encountered a Gatus Server issue.");
  const data = (await res.json()) as EndpointEntry[];
  if (!data || data?.[0]?.results === null) break;
  endpoints.push(...data);
  page++;
}

const currentEndpoints = new Map<string, { name: string; group: string }>();
for (const { key, name, group } of endpoints) {
  currentEndpoints.set(key, { name, group });
}
const existingIndex = await readIndexFile();
const keyToEntry = new Map(existingIndex.map((entry) => [entry.key, entry]));
let nextAvailableIndex =
  existingIndex.reduce((max, entry) => Math.max(max, entry.index), -1) + 1;
for (const [key, value] of currentEndpoints.entries()) {
  const existing = keyToEntry.get(key);
  if (existing) {
    existing.name = value.name;
    existing.group = value.group;
    existing.enabled = true;
  } else {
    keyToEntry.set(key, {
      index: nextAvailableIndex++,
      key,
      name: value.name,
      group: value.group,
      enabled: true,
    });
  }
}
for (const entry of keyToEntry.values()) {
  if (!currentEndpoints.has(entry.key)) {
    entry.enabled = false;
  }
}
await writeIndexFile(Array.from(keyToEntry.values()));

const dataByKey = new Map<
  string,
  Map<number, { latency: number; uptime: number; count: number }>
>();
for (const { key, results } of endpoints) {
  let map = dataByKey.get(key);
  if (!map) {
    map = new Map();
    dataByKey.set(key, map);
  }
  for (const res of results) {
    if (!res.timestamp.startsWith(yesterday)) continue;
    const hour = Number(res.timestamp.slice(11, 13));
    const latency = Math.round(res.duration / 1000000);
    const uptime = res.success ? 100 : 0;
    const entry = map.get(hour);
    if (entry) {
      entry.latency += latency;
      entry.uptime += uptime;
      entry.count++;
    } else {
      map.set(hour, { latency, uptime, count: 1 });
    }
  }
}

const indexMap = new Map(
  keyToEntry.values().map((entry) => [entry.key, entry.index]),
);
const keys = [...dataByKey.keys()].sort(
  (a, b) => (indexMap.get(a) ?? 0) - (indexMap.get(b) ?? 0),
);

const lines = ["index,hour,latency,uptime"];
for (const key of keys) {
  const map = dataByKey.get(key);
  if (!map) continue;
  const index = indexMap.get(key);
  if (index === undefined) continue;
  for (const hour of [...map.keys()].sort((a, b) => a - b)) {
    const h = map.get(hour);
    if (!h) continue;
    lines.push(
      `${index},${hour},${Math.round(h.latency / h.count)},${Number((h.uptime / h.count).toFixed(2))}`,
    );
  }
}

await write(path, lines.join("\n"));
console.log(`Successfully archived and saved data to ${path}`);
