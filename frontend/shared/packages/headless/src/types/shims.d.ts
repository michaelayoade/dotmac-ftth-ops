declare module "next/head" {
  const Head: any;
  export default Head;
}

declare module "next/script" {
  const Script: any;
  export default Script;
}

declare module "next/navigation" {
  export const useRouter: any;
  export const useSearchParams: any;
  export const usePathname: any;
}

declare module "node-fetch" {
  const fetch: any;
  export default fetch;
}

declare module "@opentelemetry/sdk-node" {
  export class NodeSDK {
    constructor(...args: any[]);
    start(): Promise<void> | void;
    shutdown(): Promise<void> | void;
  }
}

declare module "@opentelemetry/auto-instrumentations-node" {
  export function getNodeAutoInstrumentations(...args: any[]): any;
}

declare module "@opentelemetry/resources" {
  export const Resource: any;
  export const detectResources: any;
}

declare module "@opentelemetry/semantic-conventions" {
  export const SemanticResourceAttributes: Record<string, string>;
}

declare module "@opentelemetry/exporter-trace-otlp-http" {
  export class OTLPTraceExporter {
    constructor(...args: any[]);
  }
}

declare module "@opentelemetry/exporter-metrics-otlp-http" {
  export class OTLPMetricExporter {
    constructor(...args: any[]);
  }
}

declare module "@opentelemetry/sdk-metrics" {
  export class MeterProvider {
    constructor(...args: any[]);
    getMeter(...args: any[]): any;
  }
}
