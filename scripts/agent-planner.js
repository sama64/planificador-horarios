#!/usr/bin/env node

import fs from 'node:fs';

import {
  DEFAULT_CURRICULUM_ID,
  inspectAgentCurriculum,
  listAgentCurricula,
  runAgentRequest
} from '../lib/agent-planner.js';

function printJson(value, stream = process.stdout) {
  stream.write(`${JSON.stringify(value, null, 2)}\n`);
}

function readRequest(args) {
  const inputIndex = args.indexOf('--input');
  const jsonIndex = args.indexOf('--json');

  if (inputIndex !== -1) {
    const inputPath = args[inputIndex + 1];
    if (!inputPath) throw new Error('--input requires a file path or -.');
    return JSON.parse(inputPath === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(inputPath, 'utf8'));
  }

  if (jsonIndex !== -1) {
    const raw = args[jsonIndex + 1];
    if (!raw) throw new Error('--json requires a JSON object.');
    return JSON.parse(raw);
  }

  if (!process.stdin.isTTY) {
    const raw = fs.readFileSync(0, 'utf8').trim();
    return raw ? JSON.parse(raw) : {};
  }

  return {};
}

function usage() {
  return {
    success: false,
    error: 'Usage: agent:planner catalog | curriculum [ID] | solve [--input FILE|- | --json JSON]'
  };
}

try {
  const [, , command, ...args] = process.argv;
  let result;

  if (command === 'catalog') {
    result = listAgentCurricula();
  } else if (command === 'curriculum') {
    result = inspectAgentCurriculum(args[0] || DEFAULT_CURRICULUM_ID);
  } else if (command === 'solve') {
    result = runAgentRequest(readRequest(args));
  } else {
    printJson(usage(), process.stderr);
    process.exitCode = 1;
  }

  if (result) {
    printJson(result);
    if (result.success === false) process.exitCode = 2;
  }
} catch (error) {
  printJson({
    success: false,
    error: error instanceof Error ? error.message : String(error)
  }, process.stderr);
  process.exitCode = 1;
}
