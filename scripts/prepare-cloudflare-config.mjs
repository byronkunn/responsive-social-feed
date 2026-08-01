import { readFileSync, writeFileSync } from "node:fs";

const configPath = ".output/server/wrangler.json";
const config = JSON.parse(readFileSync(configPath, "utf8"));

config.observability = {
  enabled: true,
  head_sampling_rate: 1,
};

writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
