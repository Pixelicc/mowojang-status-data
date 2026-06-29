The CSV files in the data directory contain hourly endpoint metrics.
The endpoint key is referenced by index values stored in `data/index.csv`.

## Hourly Data

Contains performance metrics for each endpoint.

- **Header**: `index,hour,latency,uptime`
- **Columns**:
  - `index`: References the ID in `data/index.csv`.
  - `hour`: Hour of the day (0-23).
  - `latency`: Average latency in milliseconds.
  - `uptime`: Average uptime percentage (0-100).
