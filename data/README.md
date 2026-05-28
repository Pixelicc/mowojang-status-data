The CSV files in this directory use a two-section format to optimize storage.

## 1. Endpoint Index

Maps unique integer IDs to endpoint keys.

- **Header**: `index,name`
- **Columns**: `index`, `name` (Gatus Endpoint Key)

## 2. Hourly Data

Contains performance metrics referencing the indices above.

- **Header**: `index,hour,latency,uptime`
- **Columns**:
  - `index`: References the ID from the index section.
  - `hour`: Hour of the day (0-23).
  - `latency`: Average latency in milliseconds.
  - `uptime`: Average uptime percentage (0-100).
