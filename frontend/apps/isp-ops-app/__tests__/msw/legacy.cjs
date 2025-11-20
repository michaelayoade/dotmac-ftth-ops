const { TextEncoder, TextDecoder } = require('util');
const { createRequire } = require('module');

if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = TextEncoder;
}
if (typeof global.TextDecoder === 'undefined') {
  global.TextDecoder = TextDecoder;
}
const resolveMsw = createRequire(require.resolve('msw/package.json'));
const actualMsw = resolveMsw('.');
const HeadersCtor = typeof Headers !== 'undefined' ? Headers : require('undici').Headers;

const mergeHeaders = (base, incoming) => {
  const headers = new HeadersCtor(base || {});
  if (incoming) {
    const extra = new HeadersCtor(incoming);
    extra.forEach((value, key) => {
      headers.set(key, value);
    });
  }
  return headers;
};

const createResponse = (body = null, init = {}) => {
  return new actualMsw.HttpResponse(body, { status: 200, ...init });
};

const legacyCtx = {
  json: (body, init) => () => {
    const headers = new HeadersCtor();
    headers.set('Content-Type', 'application/json');
    if (init && init.headers) {
      const extra = new HeadersCtor(init.headers);
      extra.forEach((value, key) => {
        headers.set(key, value);
      });
    }
    const status = (init && typeof init.status === 'number') ? init.status : 200;
    // CRITICAL FIX: Must return HttpResponse.json() NOT HttpResponse(jsonString)
    // MSW v2 HttpResponse.json() properly handles JSON serialization for axios
    return actualMsw.HttpResponse.json(body, {
      status,
      headers: Object.fromEntries(headers.entries()),
    });
  },
  status: (status) => (response = createResponse()) => {
    return createResponse(response.body, {
      headers: response.headers,
      status,
    });
  },
  set: (name, value) => (response = createResponse()) => {
    const headers = new HeadersCtor(response.headers || {});
    headers.set(name, value);
    return createResponse(response.body, {
      status: response.status || 200,
      headers,
    });
  },
  body: (body) => () => createResponse(body),
  data: (data) => legacyCtx.json({ data }),
  errors: (errors) => legacyCtx.json({ errors }),
};

const legacyRes = (...transformers) => {
  return transformers.reduce((response, transformer) => transformer(response), createResponse());
};

const wrapResolver = (resolver) => {
  return async (req) => {
    const legacyReq =
      req && Object.getPrototypeOf(req)
        ? Object.assign(Object.create(Object.getPrototypeOf(req)), req)
        : { ...req };
    if (legacyReq && (legacyReq.url === undefined || legacyReq.url === null)) {
      legacyReq.url = legacyReq.request && legacyReq.request.url ? legacyReq.request.url : '';
    }
    if (legacyReq && legacyReq.request) {
      const requestClone = legacyReq.request.clone();
      let parsedBody = null;
      try {
        parsedBody = await requestClone.json();
      } catch {
        try {
          parsedBody = await requestClone.text();
        } catch {
          parsedBody = null;
        }
      }
      legacyReq.body = parsedBody;
      if (!legacyReq.json) {
        legacyReq.json = async () => parsedBody;
      }
    }
    const result = await resolver(legacyReq, legacyRes, legacyCtx);
    return result ?? createResponse();
  };
};

const createLegacyRestMethod = (method) => {
  return (path, resolver) => {
    return actualMsw.http[method](path, wrapResolver(resolver));
  };
};

const rest = {
  get: createLegacyRestMethod('get'),
  post: createLegacyRestMethod('post'),
  put: createLegacyRestMethod('put'),
  patch: createLegacyRestMethod('patch'),
  delete: createLegacyRestMethod('delete'),
  options: createLegacyRestMethod('options'),
};

const legacyHttp = new Proxy(actualMsw.http, {
  get(target, prop, receiver) {
    const original = Reflect.get(target, prop, receiver);
    if (typeof original !== 'function') {
      return original;
    }

    return (...args) => {
      if (args.length === 0) {
        return original();
      }

      const normalizedArgs = [...args];
      const lastIndex = normalizedArgs.length - 1;
      const maybeResolver = normalizedArgs[lastIndex];

      if (typeof maybeResolver === 'function') {
        normalizedArgs[lastIndex] = wrapResolver(maybeResolver);
      }

      return original.apply(target, normalizedArgs);
    };
  },
});

const legacyGraphql = new Proxy(actualMsw.graphql, {
  get(target, prop, receiver) {
    const original = Reflect.get(target, prop, receiver);
    if (typeof original !== 'function') {
      return original;
    }

    return (...args) => {
      if (args.length > 0) {
        const lastIndex = args.length - 1;
        const maybeResolver = args[lastIndex];

        if (typeof maybeResolver === 'function') {
          args[lastIndex] = wrapResolver(maybeResolver);
        }
      }

      return original.apply(target, args);
    };
  },
});

const legacyMswExports = {
  ...actualMsw,
  http: legacyHttp,
  rest,
  graphql: legacyGraphql,
  ctx: legacyCtx,
};

// Support both CommonJS and ESM imports
legacyMswExports.__esModule = true;
legacyMswExports.default = legacyMswExports;

module.exports = legacyMswExports;
