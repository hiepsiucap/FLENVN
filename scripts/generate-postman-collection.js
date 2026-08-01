const fs = require('fs');
const path = require('path');

const OPENAPI_PATH = path.resolve(__dirname, '..', 'openapi.json');
const OUTPUT_PATH = path.resolve(__dirname, '..', 'postman.collection.json');

function normalizePathParts(rawPath) {
  const parts = rawPath.split('/').filter(Boolean);
  // Remove global prefix pieces if present: /api/v1/...
  if (parts[0] === 'api' && parts[1] === 'v1') {
    return parts.slice(2);
  }
  return parts;
}

function getFolderName(rawPath) {
  const parts = normalizePathParts(rawPath);
  if (parts.length === 0) return 'App';
  const first = parts[0];
  return first.charAt(0).toUpperCase() + first.slice(1);
}

function toCamelCase(value) {
  const words = String(value)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean);

  if (words.length === 0) return '';

  const [first, ...rest] = words;
  return [
    first.charAt(0).toLowerCase() + first.slice(1),
    ...rest.map((word) => word.charAt(0).toUpperCase() + word.slice(1)),
  ].join('');
}

function buildRequestName(method, rawPath, operation) {
  if (operation?.summary) return toCamelCase(operation.summary);
  if (operation?.operationId) {
    const cleaned = operation.operationId
      .replace(/^.*Controller_/, '')
      .trim();

    return toCamelCase(cleaned) || toCamelCase(`${method} ${rawPath}`);
  }
  return toCamelCase(`${method} ${rawPath}`);
}

function buildUrl(rawPath, operation) {
  const url = {
    raw: '{{baseUrl}}' + rawPath,
    host: ['{{baseUrl}}'],
    path: rawPath.split('/').filter(Boolean),
  };

  const queryParams = (operation?.parameters || [])
    .filter((parameter) => parameter.in === 'query')
    .map((parameter) => ({
      key: parameter.name,
      value: `{{${parameter.name}}}`,
      description: parameter.description || '',
    }));

  if (queryParams.length > 0) {
    url.query = queryParams;
  }

  return url;
}

function resolveRef(ref, openapi) {
  if (!ref || typeof ref !== 'string') return undefined;
  const prefix = '#/components/schemas/';
  if (!ref.startsWith(prefix)) return undefined;
  const key = ref.slice(prefix.length);
  return openapi?.components?.schemas?.[key];
}

function schemaToExample(schema, openapi, visitedRefs = new Set()) {
  if (!schema) return undefined;

  if (schema.example !== undefined) {
    return schema.example;
  }

  if (schema.default !== undefined) {
    return schema.default;
  }

  if (schema.$ref) {
    if (visitedRefs.has(schema.$ref)) {
      return {};
    }

    const target = resolveRef(schema.$ref, openapi);
    if (!target) return {};

    const nextVisited = new Set(visitedRefs);
    nextVisited.add(schema.$ref);
    return schemaToExample(target, openapi, nextVisited);
  }

  if (Array.isArray(schema.enum) && schema.enum.length > 0) {
    return schema.enum[0];
  }

  if (
    schema.type === 'object' ||
    schema.properties ||
    schema.additionalProperties
  ) {
    const output = {};
    const properties = schema.properties || {};

    for (const [key, value] of Object.entries(properties)) {
      const propertyExample = schemaToExample(value, openapi, visitedRefs);
      if (propertyExample !== undefined) {
        output[key] = propertyExample;
      }
    }

    if (
      Object.keys(output).length === 0 &&
      schema.additionalProperties &&
      typeof schema.additionalProperties === 'object'
    ) {
      output.key = schemaToExample(
        schema.additionalProperties,
        openapi,
        visitedRefs,
      );
    }

    return output;
  }

  if (schema.type === 'array') {
    if (!schema.items) return [];
    return [schemaToExample(schema.items, openapi, visitedRefs)];
  }

  switch (schema.type) {
    case 'string':
      if (schema.format === 'email') return 'user@example.com';
      if (schema.format === 'uuid')
        return '00000000-0000-0000-0000-000000000000';
      if (schema.format === 'date-time') return new Date().toISOString();
      return '';
    case 'number':
    case 'integer':
      return 0;
    case 'boolean':
      return false;
    default:
      return undefined;
  }
}

function buildBody(operation, openapi) {
  const mediaType = operation?.requestBody?.content?.['application/json'];
  if (!mediaType) return undefined;

  const exampleBody = schemaToExample(mediaType.schema, openapi);

  return {
    mode: 'raw',
    raw: JSON.stringify(exampleBody !== undefined ? exampleBody : {}, null, 2),
    options: {
      raw: {
        language: 'json',
      },
    },
  };
}

function main() {
  if (!fs.existsSync(OPENAPI_PATH)) {
    throw new Error(`Missing file: ${OPENAPI_PATH}`);
  }

  const openapi = JSON.parse(fs.readFileSync(OPENAPI_PATH, 'utf8'));
  const paths = openapi.paths || {};
  const globalSecurity = Array.isArray(openapi.security)
    ? openapi.security
    : [];
  const foldersMap = new Map();

  for (const [rawPath, methods] of Object.entries(paths)) {
    const folderName = getFolderName(rawPath);
    if (!foldersMap.has(folderName)) foldersMap.set(folderName, []);

    for (const [method, operation] of Object.entries(methods)) {
      const request = {
        name: buildRequestName(method, rawPath, operation),
        request: {
          method: method.toUpperCase(),
          header: [
            {
              key: 'Content-Type',
              value: 'application/json',
            },
          ],
          url: buildUrl(rawPath, operation),
        },
      };

      const body = buildBody(operation, openapi);
      if (body) {
        request.request.body = body;
      }

      const explicitlyPublic =
        rawPath === '/api/v1' ||
        rawPath.includes('/auth/login') ||
        rawPath.includes('/auth/register') ||
        rawPath.includes('/auth/verify-email') ||
        rawPath.includes('/auth/refresh') ||
        rawPath.includes('/books/public');

      const operationSecurity = Array.isArray(operation.security)
        ? operation.security
        : [];
      const isSecuredBySpec =
        operationSecurity.length > 0 || globalSecurity.length > 0;
      const secured = !explicitlyPublic && isSecuredBySpec;

      if (secured) {
        request.request.auth = {
          type: 'bearer',
          bearer: [
            {
              key: 'token',
              value: '{{accessToken}}',
              type: 'string',
            },
          ],
        };
      }

      foldersMap.get(folderName).push(request);
    }
  }

  const folderItems = [...foldersMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, items]) => ({
      name,
      item: items.sort((x, y) => x.name.localeCompare(y.name)),
    }));

  const collection = {
    info: {
      name:
        (openapi.info && openapi.info.title ? openapi.info.title : 'API') +
        ' Collection',
      _postman_id: 'a4cf7280-20b7-4ad0-8a34-2d98a50b7f1e',
      schema:
        'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
      description: 'Generated from openapi.json',
    },
    item: folderItems,
    variable: [
      {
        key: 'baseUrl',
        value: 'http://localhost:5000',
      },
      {
        key: 'accessToken',
        value: '',
      },
    ],
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(collection, null, 2), 'utf8');
  process.stdout.write(`Postman collection generated: ${OUTPUT_PATH}\n`);
}

main();
