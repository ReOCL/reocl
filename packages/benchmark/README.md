# benchmark

Benchmarks ReOCL against eager evaluation and OCL.js on OCL invariant checking.

## Usage

Run the benchmark:

```sh
bun run start [--sizes=100,1000,10000] [--ops=10000] [--ops-scale]
```

Options:

| Flag          | Default                         | Description                      |
| ------------- | ------------------------------- | -------------------------------- |
| `--sizes`     | `100,1000,10000,100000,1000000` | Comma-separated collection sizes |
| `--ops`       | `10000`                         | Base number of mutations         |
| `--ops-scale` | on                              | Scale mutations down for large N |

Run for default parameters:

```sh
bun run start
```

Generate figures:

```sh
bun run plot
```

Writes `results/rq2.json`, `results/rq2.csv`, and PDFs in `figures/`. You'll need a working Python environment with `matplotlib`.

## Layout

- [src](src/) - benchmark implementations
- [scripts](scripts/) - result plotting
- [results](results/) - measured results
