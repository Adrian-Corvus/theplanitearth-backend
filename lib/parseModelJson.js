function stripCodeFences(text) {
  return text.replace(/```json|```/gi, '').trim();
}

function extractBalancedJson(text) {
  const start = text.search(/[\[{]/);
  if (start === -1) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i += 1) {
    const char = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '{' || char === '[') {
      depth += 1;
      continue;
    }

    if (char === '}' || char === ']') {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }

  return null;
}

export function parseModelJson(rawText, context = 'model response') {
  const cleaned = stripCodeFences(String(rawText || ''));

  try {
    return JSON.parse(cleaned);
  } catch {
    const extracted = extractBalancedJson(cleaned);
    if (extracted) {
      try {
        return JSON.parse(extracted);
      } catch {
        // Fall through to the detailed error below.
      }
    }
  }

  const preview = cleaned.slice(0, 400).replace(/\s+/g, ' ');
  throw new SyntaxError(`Failed to parse ${context} as JSON. Response preview: ${preview}`);
}
