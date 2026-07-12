#!/usr/bin/env node

import { validateRemoteClaims } from "./lib/remote-claims-contract.mjs";
import { runCli } from "./lib/validator-runtime.mjs";

await runCli("validate-remote-claims", async () => validateRemoteClaims(process.cwd(), process.argv.slice(2)));
