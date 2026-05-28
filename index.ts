import { write } from "bun";

const today = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
const path = `data/${today}.csv`;

const endpoints = [];
let page = 1;
while (true) {
  if (page > 100) throw new Error("Killswitch activated.");
  console.log(`Fetching page ${page}...`);
  const res = await fetch(
    `https://mowojang-status.pixelic.dev/api/v1/endpoints/statuses?page=${page}&pageSize=50`,
  );
  if (!res.ok) throw new Error("Encountered a Gatus Server issue.");
  const data = (await res.json()) as any[];
  if (!data || data?.[0]?.results === null) break;
  endpoints.push(...data);
  page++;
}

const data = new Map<
  string,
  Map<number, { l: number; u: number; c: number }>
>();
for (const endpoint of endpoints) {
  const { key, results } = endpoint;
  let map = data.get(key);
  if (!map) data.set(key, (map = new Map()));
  for (const res of results) {
    if (!res.timestamp.startsWith(today)) continue;
    const hour = Number(res.timestamp.slice(11, 13));
    const latency = Math.round(res.duration / 1000000);
    const uptime = res.success ? 100 : 0;
    const entry = map.get(hour);
    if (entry) {
      entry.l += latency;
      entry.u += uptime;
      entry.c++;
    } else {
      map.set(hour, { l: latency, u: uptime, c: 1 });
    }
  }
}

const keys = Array.from(data.keys()).sort();
const rows: any[][] = [];
for (const [i, key] of keys.entries()) {
  const map = data.get(key);
  if (!map) continue;
  const hours = Array.from(map.keys()).sort((a, b) => a - b);
  for (const hour of hours) {
    const h = map.get(hour);
    if (!h) continue;
    rows.push([i, hour, Math.round(h.l / h.c), Number((h.u / h.c).toFixed(2))]);
  }
}

await write(
  path,
  [
    "index,name",
    ...keys.map((key, i) => `${i},"${key.replace(/"/g, '""')}"`),
    "",
    "index,hour,latency,uptime",
    ...rows.map((row) => row.join(",")),
  ].join("\n"),
);
console.log(`Successfully archived and saved data to ${path}`);
